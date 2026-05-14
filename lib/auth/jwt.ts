import jwt, { SignOptions } from "jsonwebtoken";

type JwtPayload = {
  sub: string | number;
  username: string;
  type: "access" | "refresh";
};

const JWT_SECRET: jwt.Secret = process.env.JWT_ACCESS_SECRET as string;
const ACCESS_EXPIRES: SignOptions["expiresIn"] = (process.env
  .ACCESS_TOKEN_EXPIRES_IN || "15m") as unknown as SignOptions["expiresIn"];
const REFRESH_EXPIRES: SignOptions["expiresIn"] = (process.env
  .REFRESH_TOKEN_EXPIRES_IN || "30d") as unknown as SignOptions["expiresIn"];

if (!JWT_SECRET) {
  throw new Error("JWT_ACCESS_SECRET env var is required");
}

export function signAccessToken(
  payload: Omit<JwtPayload, "type">,
  expiresIn?: SignOptions["expiresIn"]
) {
  return jwt.sign({ ...payload, type: "access" }, JWT_SECRET, {
    expiresIn: expiresIn ?? ACCESS_EXPIRES,
  });
}

export function signRefreshToken(
  payload: Omit<JwtPayload, "type">,
  expiresIn?: SignOptions["expiresIn"]
) {
  return jwt.sign({ ...payload, type: "refresh" }, JWT_SECRET, {
    expiresIn: expiresIn ?? REFRESH_EXPIRES,
  });
}

export function verifyToken<T extends JwtPayload>(token: string) {
  return jwt.verify(token, JWT_SECRET) as T;
}

export function decodeToken<T = unknown>(token: string) {
  return jwt.decode(token) as T | null;
}
