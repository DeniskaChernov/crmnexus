import { SignJWT, jwtVerify } from "jose";

function secretKey() {
  const s = process.env["JWT_SECRET"];
  if (!s) {
    throw new Error("JWT_SECRET is not set");
  }
  return new TextEncoder().encode(s);
}

export async function signUserToken(user: {
  id: string;
  email: string;
  name?: string | null;
  role: string;
}): Promise<string> {
  return new SignJWT({
    email: user.email,
    name: user.name ?? "",
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("14d")
    .sign(secretKey());
}

export async function verifyBearer(token: string) {
  const { payload } = await jwtVerify(token, secretKey());
  return payload as {
    sub: string;
    email?: string;
    name?: string;
    role?: string;
  };
}
