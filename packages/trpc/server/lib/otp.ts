import crypto from "crypto";
import generator from "otp-generator";

import { env } from "@pno/env/server";

export const genOtp = (email: string, expiresInMinutes = 5) => {
  const ttl = expiresInMinutes * 60 * 1000;
  const expires = Date.now() + ttl;

  const otp = generator.generate(6, {
    digits: true,
    lowerCaseAlphabets: false,
    upperCaseAlphabets: false,
    specialChars: false,
  });

  const data = `${email}.${otp}.${expires}`;
  const base = crypto
    .createHmac("sha256", env.PNO_ENCRYPTION_KEY)
    .update(data)
    .digest("hex");

  return { hash: `${base}.${expires}`, otp };
};

type VerifyResult = {
  success: boolean;
  expired?: boolean;
};

export const verifyOtp = (
  email: string,
  otp: string,
  hash: string,
): VerifyResult => {
  if (!hash.includes("."))
    return {
      success: false,
    };

  const [base, expires] = hash.split(".");
  const expiresMs = Number.parseInt(expires ?? "", 10);
  if (!base || !expires || !Number.isFinite(expiresMs))
    return {
      success: false,
    };

  if (Date.now() > expiresMs)
    return {
      success: false,
      expired: true,
    };

  const data = `${email}.${otp}.${expires}`;
  const newHash = crypto
    .createHmac("sha256", env.PNO_ENCRYPTION_KEY)
    .update(data)
    .digest("hex");

  const expected = Buffer.from(newHash, "hex");
  const actual = Buffer.from(base, "hex");
  const valid =
    expected.length === actual.length &&
    crypto.timingSafeEqual(expected, actual);

  return { success: valid, expired: false };
};
