"use client";

import {
    createContext,
    useContext,
    useState,
    useEffect,
    ReactNode,
} from "react";

interface User {
    username: string;
}

interface AuthContextType {
    user: User | null;
    isLoggedIn: boolean;
    login: (username: string) => void;
    logout: () => void;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    // Check for existing session on mount via server
    useEffect(() => {
        let isMounted = true;
        const fetchMe = async () => {
            try {
                let res = await fetch("/api/users/auth/me", {
                    cache: "no-store",
                });
                if (res.status === 401) {
                    // Access token might be expired – attempt silent refresh
                    const refreshRes = await fetch("/api/users/auth/refresh", {
                        method: "POST",
                    });
                    if (refreshRes.ok) {
                        // Try /me again after successful refresh
                        res = await fetch("/api/users/auth/me", {
                            cache: "no-store",
                        });
                    } else {
                        // Refresh failed, user is not authenticated
                        if (!isMounted) return;
                        setUser(null);
                        setLoading(false);
                        return;
                    }
                }
                const data = await res.json();
                if (!isMounted) return;
                // Only set user if status is 200 and user exists
                if (res.status === 200 && data.user) {
                    setUser(data.user);
                } else {
                    setUser(null);
                }
            } catch (error) {
                if (!isMounted) return;
                setUser(null);
            } finally {
                if (isMounted) setLoading(false);
            }
        };
        fetchMe();
        return () => {
            isMounted = false;
        };
    }, []);

    const login = (username: string) => {
        setUser({ username });
    };

    const logout = async () => {
        try {
            await fetch("/api/users/auth/logout", { method: "POST" });
        } catch {}
        setUser(null);
    };

    const value = {
        user,
        isLoggedIn: !!user,
        login,
        logout,
        loading,
    };

    return (
        <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
