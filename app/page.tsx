import { redirect } from "next/navigation";
import { getAccessTokenFromDB } from "@/lib/auth/db-tokens";
import { verifyToken } from "@/lib/auth/jwt";

export default async function Home() {
    // Check for valid session using DB token approach
    const token = await getAccessTokenFromDB();
    console.log("[/] token_present", !!token);
    if (token) {
        try {
            const payload = verifyToken<any>(token);
            console.log("[/] token_verified", {
                type: payload?.type,
                sub: payload?.sub,
            });
            if (payload?.type === "access") {
                return redirect("/protected");
            }
        } catch (e: any) {
            if (e?.digest && String(e.digest).startsWith("NEXT_REDIRECT")) {
                throw e;
            }
            console.log("[/] token_verify_failed", e);
        }
    }
    console.log("[/] redirecting_to_login");
    return redirect("/auth/login");
}
