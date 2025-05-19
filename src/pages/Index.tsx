
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";

const Index = () => {
  const handleBookTickets = () => {
    toast({
      title: "Feature coming soon!",
      description: "Ticket booking is not available yet. Stay tuned for updates!",
    });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#fdfcfb] to-[#e2d1c3] px-4">
      <header className="mb-12 text-center">
        <h1 className="text-5xl font-extrabold bg-gradient-to-r from-purple-500 via-pink-400 to-yellow-400 text-transparent bg-clip-text drop-shadow-lg mb-3 animate-fade-in">Rail Reserve Nexus</h1>
        <p className="text-lg text-gray-700 dark:text-gray-200 font-medium animate-fade-in">
          Your journey begins here. Book trains, manage reservations, and explore routes with ease.
        </p>
      </header>
      <Card className="w-full max-w-md shadow-xl border-0 glass-morphism animate-scale-in">
        <CardHeader>
          <CardTitle className="text-center">Get Started</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <p className="text-gray-600 dark:text-gray-300 text-center">
            Ready to begin your railway adventure? Click below to start exploring.
          </p>
          <Button size="lg" className="w-full font-semibold animate-pulse" onClick={handleBookTickets}>
            Book Tickets
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Index;
