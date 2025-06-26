/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck

import { Page } from "puppeteer";

interface Flight {
  airlineLogo: string;
  departureTime: string;
  arrivalTime: string;
  flightDuration: string;
  airlineName: string;
  price: number;
}

export const startFlightScraping = async (page: Page): Promise<Flight[]> => {
  console.log("🛫 [startFlightScraping] Yatra scraping started...");

  const maxRetries = 5;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`🔁 Attempt ${attempt}/${maxRetries}...`);

    try {
      await page.waitForFunction(
        () => {
          const title = document.title.toLowerCase();
          return !title.includes("challenge validation");
        },
        { timeout: 20000 }
      );

      await page.waitForSelector(".flightItem", { timeout: 15000 });

      const flights = await page.evaluate((): Flight[] => {
        const flightCards = document.querySelectorAll(".flightItem");
        const flights: Flight[] = [];

        flightCards.forEach((card, index) => {
          try {
            const airlineName =
              card.querySelector(".airline-name span")?.textContent?.trim() ||
              "";

            const departureTime =
              card
                .querySelector(".depart-details .mob-time")
                ?.textContent?.trim() || "";

            const arrivalTime =
              card
                .querySelector(".arrival-details .mob-time")
                ?.textContent?.trim() || "";

            const flightDuration =
              card
                .querySelector(".stops-details .mob-duration")
                ?.textContent?.trim() || "";

            const logoImg = card.querySelector(
              ".airline-holder img"
            ) as HTMLImageElement;
            const airlineLogo = logoImg?.src || "";

            const priceElements = card.querySelectorAll(".fare-price");
            let price = 0;
            priceElements.forEach((el) => {
              const raw = el.textContent?.replace(/[^\d]/g, "") || "0";
              const parsed = parseInt(raw, 10) || 0;
              if (price === 0 || parsed < price) price = parsed;
            });

            flights.push({
              airlineLogo,
              departureTime,
              arrivalTime,
              flightDuration,
              airlineName,
              price,
            });
          } catch (err) {
            console.error(`❌ Failed to parse flight #${index + 1}:`, err);
          }
        });

        return flights;
      });

      if (flights.length > 0) {
        console.log(
          `✅ Scraped ${flights.length} flights on attempt ${attempt}`
        );
        return flights;
      }

      console.warn(`⚠️ No flights found on attempt ${attempt}. Retrying...`);
      await new Promise((res) => setTimeout(res, 3000));
    } catch (err) {
      console.warn(`⚠️ Error on attempt ${attempt}:`, err.message);
      await new Promise((res) => setTimeout(res, 3000));
    }
  }

  console.error("❌ All retries exhausted. No flights scraped.");
  return [];
};
