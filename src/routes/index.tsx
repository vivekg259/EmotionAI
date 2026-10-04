import { createFileRoute } from "@tanstack/react-router";
import { HammApp } from "@/components/hamm/HammApp";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <HammApp />;
}
