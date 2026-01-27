"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [message, setmessage] = useState("");

  useEffect(() => {
    fetch("http://127.0.0.1:8000/")
      .then((res) => res.json())
      .then((data) => {
        setmessage(data.message);
      });
  }, []);

  return (
    <div>
      <h1>Server Says : {message}</h1>
    </div>
  );
}
