import jwt from "jsonwebtoken";
import { User } from "../../src/models/user.model";

const JWT_SECRET = process.env.JWT_SECRET || "insecure";

/**
 * `authenticate` rechaza el token de una cuenta que no existe, y lee rol y verificación de la
 * base. Firma el JWT y crea la cuenta (si no está) con el rol y la verificación del token.
 * Si la cuenta ya existe no se toca.
 */
export const sessionToken = async (payload: { _id?: string; id?: string; role?: string; isVerified?: boolean; [k: string]: unknown }) => {
  const id = String(payload._id || payload.id);
  await User.updateOne(
    { _id: id },
    {
      $setOnInsert: {
        name: `Usuario ${id.slice(-4)}`,
        email: `sesion-${id}@test.com`,
        role: payload.role || "tenant",
        isVerified: Boolean(payload.isVerified),
      },
    },
    { upsert: true },
  );
  return jwt.sign(payload, JWT_SECRET);
};

/** `Bearer <token>` de `sessionToken` para un id y un rol. */
export const bearer = async (_id: string, role: string) => `Bearer ${await sessionToken({ _id, role })}`;
