"use client";
import React, { useEffect, useState } from "react";
import Landing from "@/components/Landing";

interface User {
  id: number;
  username: string;
  role: string;
  email?: string;
}

export default function Home() {
  const [currentUser, setCurrentUser] = useState<User | null | undefined>(undefined);

  const loadCurrentUser = async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      const data = await res.json();
      setCurrentUser(data.user || null);
    } catch (err) {
      setCurrentUser(null);
    }
  };

  useEffect(() => {
    loadCurrentUser();
  }, []);

  return <Landing currentUser={currentUser} />;
}
