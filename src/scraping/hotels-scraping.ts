/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { Browser, Page } from "puppeteer";

export const startHotelScraping = async (
  page: Page,
  browser: Browser,
  location: string
) => {
  await page.setViewport({ width: 1920, height: 1080 });
  console.log("Viewport set.");

  await page.waitForSelector(".Input_input__hHazC");
  const locationInput = await page.$(".Input_input__hHazC");
  if (!locationInput) throw new Error("Location input not found.");

  await locationInput.click({ clickCount: 3 });
  await locationInput.type(location);
  console.log(`Typed location: ${location}`);

  await page.waitForSelector(".SearchList_listing__HQ9V7", { timeout: 10000 });
  await new Promise((res) => setTimeout(res, 1000));

  const firstSuggestion = await page.$(".SearchItems_details__6nDmU");
  if (!firstSuggestion) throw new Error("No suggestions found.");
  await firstSuggestion.click();
  console.log("First suggestion clicked.");

  await page.waitForSelector(".react-datepicker", { timeout: 10000 });
  console.log("Date picker ready.");

  const selectedDates = await page.$$(".CustomDatePicker_selectedDate__8U0ND");
  if (selectedDates.length < 2) {
    console.log("Selecting default dates...");
    const today = new Date();
    const checkinDateStr = today.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const checkoutDateStr = tomorrow.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });

    const checkinEl = await page.$(`[aria-label="Choose ${checkinDateStr}"]`);
    const checkoutEl = await page.$(`[aria-label="Choose ${checkoutDateStr}"]`);

    if (checkinEl) {
      await checkinEl.click();
      console.log("Default check-in selected.");
    }
    if (checkoutEl) {
      await checkoutEl.click();
      console.log("Default check-out selected.");
    }
  } else {
    console.log("Dates already selected.");
  }

  await page.waitForSelector(".SearchPanel_buttonSearch__Yirei");
  const searchButton = await page.$(".SearchPanel_buttonSearch__Yirei");
  if (!searchButton) throw new Error("Search button not found.");

  console.log("Clicking search...");
  const [target] = await Promise.all([
    new Promise((res) => browser.once("targetcreated", res)),
    searchButton.click()
  ]);

  const newPage = await target.page();
  await new Promise((res) => setTimeout(res, 2000));
  await newPage.bringToFront();
  console.log("New tab opened for results.");

  await new Promise((res) => setTimeout(res, 10000));
  console.log("Waiting for results...");

  return await newPage.evaluate(() => {
    const hotels = [];
    const hotelEls = document.querySelectorAll("[data-testid='hotel-card'], .hotel-item, .hotel-card");

    hotelEls.forEach((el) => {
      const title = el.querySelector(".hotel-name, .title, h3, h2")?.innerText?.trim();
      const priceText = el.querySelector(".price, .rate, .cost")?.innerText?.trim();
      const price = priceText ? parseInt(priceText.replace(/[^\d]/g, ""), 10) : null;
      const photo = el.querySelector("img")?.src;

      if (title && price && photo) {
        hotels.push({ title, price, photo });
      }
    });

    console.log(`Extracted ${hotels.length} hotels.`);
    return hotels;
  });
};

