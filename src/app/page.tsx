import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const steps = [
  "Scrape memes from Reddit",
  "Review and approve on the dashboard",
  "Schedule posts across days",
  "Publish automatically to Instagram",
];

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Reddit → Instagram</h1>
        <Badge variant="secondary">Scaffold</Badge>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Dashboard coming soon</CardTitle>
          <CardDescription>The project scaffold is ready.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            {steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </main>
  );
}
