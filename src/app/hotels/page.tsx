"use client";
import { apiClient } from "@/lib";
import { useAppStore } from "@/store";
import { USER_API_ROUTES } from "@/utils";
import { Button } from "@heroui/react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import React from "react";
import { FaChevronLeft } from "react-icons/fa";
import Razorpay from "razorpay";

const Hotels = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const date = searchParams.get("date");
  const { scrapedHotels, userInfo } = useAppStore();

  const bookHotel = async (hotelId: number) => {
    try {
      const isoDate = date
        ? new Date(date).toISOString()
        : new Date().toISOString();

      const res = await apiClient.post(USER_API_ROUTES.CREATE_BOOKING, {
        bookingId: hotelId, // Assuming flightData contains your flight details
        bookingType: "flights", // Differentiate as flights
        userId: userInfo?.id,
        taxes: 30,
        date: isoDate,
      });

      if (!res || !res.data?.orderId) {
        console.error("Failed to create flight booking or order");
        return;
      }

      const options = {
        key: res.data.keyId,
        amount: res.data.amount, // Amount in paise
        currency: res.data.currency,
        name: "Flight Booking",
        description: "Payment for your flight",
        order_id: res.data.orderId,
        handler: async function (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) {
          // Verify payment
          const verification = await fetch("/api/verifyOrder", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              orderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            }),
          });

          const data = await verification.json();
          if (data.isOk) {
            await apiClient.patch(USER_API_ROUTES.CREATE_BOOKING, {
              paymentIntent: res.data.orderId,
            });
            setTimeout(() => {
              router.push("/my-bookings");
            }, 3000);
            alert("Payment successful!");
          } else {
            alert("Payment verification failed.");
          }
        },
        prefill: {
          name: userInfo?.firstName,
          email: userInfo?.email,
        },
        theme: {
          color: "#1DBF73",
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (error) {
      console.error("Error while booking flight:", error);
    }
  };
  return (
    <div className="m-10 px-[20vw] min-h-[80vh]">
      <Button
        className="my-5"
        variant="shadow"
        color="primary"
        size="lg"
        onPress={() => router.push("/search-hotels")}
      >
        <FaChevronLeft />
        Go Back
      </Button>
      <div className=" flex flex-col gap-5">
        {scrapedHotels.length === 0 && (
          <div className="flex items-center justify-center mt-10   py-5 px-10 rounded-lg text-red-500 bg-red-100 font-medium">
            No Hotels Found
          </div>
        )}
        {scrapedHotels.length !== 0 && (
          <div>
            <div className="grid grid-cols-3 gap-10">
              {scrapedHotels.map((hotel) => {
                return (
                  <div
                    key={hotel.id}
                    className="flex flex-col items-center justify-center cursor-pointer shadow-md rounded-2xl p-4 border border-neutral-200"
                  >
                    <div className="mb-3  relative w-full h-48">
                      <Image
                        src={hotel.image}
                        alt="hotel"
                        fill
                        className="rounded-2xl"
                      />
                    </div>
                    <div className="w-full flex flex-col items-start gap-1">
                      <h3 className="font-semibold capitalize text-neutral-900  text-base">
                        {hotel.name}
                      </h3>
                      <span className="text-sm text-neutral-500 font-normal">
                        <strong className="text-black">${hotel.price}</strong>{" "}
                        /night
                      </span>
                      <Button
                        size="md"
                        variant="ghost"
                        color="danger"
                        className="mt-2"
                        onPress={() => userInfo && bookHotel(hotel.id)}
                      >
                        {!userInfo ? "Login to Book Now" : "Book Now"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Hotels;