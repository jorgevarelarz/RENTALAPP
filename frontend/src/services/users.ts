import { api as axios } from "../api/client";
import { User } from "./auth";

export async function updateUserProfile(userId: string, payload: Partial<Pick<User, "name" | "email">>) {
  const { data } = await axios.patch(`/api/users/${userId}`, payload);
  return data as User;
}
