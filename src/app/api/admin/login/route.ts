import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { SignJWT } from "jose";
import prisma from "../../../../lib/prisma";
import { Prisma } from "@prisma/client";
import { cookies } from "next/headers";

// console.log("✅ API route initialized");


const secret = new TextEncoder().encode(process.env.JWT_KEY as string);
const alg = "HS256";

const createToken = async (email: string, userId: number) => {
  return await new SignJWT({ email, userId, isAdmin: true })
    .setProtectedHeader({ alg })
    .setExpirationTime("48h")
    .sign(secret);
};

console.log("reaching")

export async function POST(request: Request) {
  const { email, password } = await request.json();

  console.log("reaching route")
  
  if (!email || !password) {
    return NextResponse.json(
      { message: "Email and password is required." },
      { status: 400 }
    );
  }

  try {
    // First, find user by email only
    const user = await prisma.admin.findUnique({
      where: { email },
    });

    if (!user) {
      console.log("no user")
      return NextResponse.json(
        { msg: "Invalid Email or Password" },
        { status: 404 }
      );
    }

    // Compare the provided password with the hashed password
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      console.log("incorrect password")
      return NextResponse.json(
        { msg: "Invalid Email or Password" },
        { status: 404 }
      );
    }

    // If password matches, create token and return success
    const token = await createToken(user.email, user.id);
    (await cookies()).set("access_token", token);
    
    return NextResponse.json(
      {
        access_token: token,
        userInfo: {
          id: user.id,
          email: user.email,
        },
      },
      { status: 200 }
    );

  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json({ message: error.message }, { status: 400 });
      }
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
  }

  return NextResponse.json(
    { message: "An unexpected error occurred." },
    { status: 500 }
  );
}