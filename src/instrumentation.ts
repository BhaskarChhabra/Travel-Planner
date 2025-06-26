import { Browser } from "puppeteer";
import { startLocationScraping, startPackageScraping } from "./scraping";
import prisma from "./lib/prisma";
import { startFlightScraping } from "./scraping/flights-scraping";
import { startHotelScraping } from "./scraping/hotels-scraping";

export const register = async () => {
  if (process.env.NEXT_RUNTIME == "nodejs") {
    const admin = await prisma.admin.count();
    console.log({ admin });
    if (!admin) {
      console.log("Creating admin...");
      const data = await prisma.admin.create({
        data: {
          email: "admin@arklyte.com",
          password:
            "$2b$10$DcLZAJBMPrECJROnQut8k.XcKjiVnB2v8SMGkIz07W5vjEnUnYoIm",
        },
      });
      console.log({ data });
    }

    const { Worker } = await import("bullmq");
    const { connection } = await import("@/lib/redis");
    const { jobsQueue } = await import("@/lib/queue");

    new Worker(
      "jobsQueue",
      async (job) => {
        let browser: undefined | Browser = undefined;
        try {
          const puppeteerExtra = (await import("puppeteer-extra")).default;
          const StealthPlugin = (await import("puppeteer-extra-plugin-stealth"))
            .default;

          puppeteerExtra.use(StealthPlugin());

          browser = await puppeteerExtra.launch({
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
          });

          const page = await browser.newPage();
          await page.setUserAgent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/114.0.0.0 Safari/537.36"
          );

          console.log("Connected! Navigating to " + job.data.url);
          await page.goto(job.data.url, {
            waitUntil: "networkidle2",
            timeout: 60000,
          });
          console.log("Navigated! Scraping page content...");

          if (job.data.jobType.type === "location") {
            const packages = await startLocationScraping(page);
            await prisma.jobs.update({
              where: { id: job.data.id },
              data: { isComplete: true, status: "complete" },
            });
            for (const pkg of packages) {
              const jobCreated = await prisma.jobs.findFirst({
                where: {
                  url: `https://packages.yatra.com/holidays/intl/details.htm?packageId=${pkg?.id}`,
                },
              });
              if (!jobCreated) {
                const job = await prisma.jobs.create({
                  data: {
                    url: `https://packages.yatra.com/holidays/intl/details.htm?packageId=${pkg?.id}`,
                    jobType: { type: "package" },
                  },
                });
                jobsQueue.add("package", { ...job, packageDetails: pkg });
              }
            }
          } else if (job.data.jobType.type === "package") {
            console.log("In package job...");
            const alreadyScraped = await prisma.trips.findUnique({
              where: { id: job.data.packageDetails.id },
            });
            if (!alreadyScraped) {
              const pkg = await startPackageScraping(
                page,
                job.data.packageDetails
              );
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              await prisma.trips.create({ data: pkg });
              await prisma.jobs.update({
                where: { id: job.data.id },
                data: { isComplete: true, status: "complete" },
              });
            }
          } else if (job.data.jobType.type === "flight") {
            console.log("In flight job...");
            const flights = await startFlightScraping(page);
            await prisma.jobs.update({
              where: { id: job.data.id },
              data: { isComplete: true, status: "complete" },
            });
            for (const flight of flights) {
              await prisma.flights.create({
                data: {
                  name: flight.airlineName,
                  logo: flight.airlineLogo,
                  from: job.data.jobType.source,
                  to: job.data.jobType.destination,
                  departureTime: flight.departureTime,
                  arrivalTime: flight.arrivalTime,
                  duration: flight.flightDuration,
                  price: flight.price,
                  jobId: job.data.id,
                },
              });
            }
          } else if (job.data.jobType.type === "hotels") {
            console.log("In hotels job...");

            // Screenshot for debugging before scraping
            await page.screenshot({
              path: `debug_hotels_${job.data.id}.png`,
              fullPage: true,
            });
            console.log(
              `Debug screenshot saved as debug_hotels_${job.data.id}.png`
            );

            const hotels = await startHotelScraping(
              page,
              browser,
              job.data.location
            );
            for (const hotel of hotels) {
              await prisma.hotels.create({
                data: {
                  name: hotel.title,
                  image: hotel.photo,
                  price: hotel.price,
                  jobId: job.data.id,
                  location: job.data.location.toLowerCase(),
                },
              });
            }
            await prisma.jobs.update({
              where: { id: job.data.id },
              data: { isComplete: true, status: "complete" },
            });
          }
        } catch (err) {
          console.error(err);
          await prisma.jobs.update({
            where: { id: job.data.id },
            data: { isComplete: true, status: "failed" },
          });
        } finally {
          await browser?.close();
          console.log("Browser closed successfully.");
        }
      },
      {
        connection,
        concurrency: 10,
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      }
    );
  }
};
