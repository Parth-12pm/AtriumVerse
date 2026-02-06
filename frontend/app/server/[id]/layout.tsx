import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Server | AtriumVerse",
  description: "Virtual Space",
};

export default function ServerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
