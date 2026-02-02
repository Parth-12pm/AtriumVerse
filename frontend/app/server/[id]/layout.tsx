import type { Metadata } from "next";
import ServerHUD from "../../../components/game/ServerHUD";

export const metadata: Metadata = {
  title: "Server | AtriumVerse",
  description: "Virtual Space",
};

export default function ServerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ServerHUD>{children}</ServerHUD>;
}
