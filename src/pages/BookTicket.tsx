
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const BookTicket = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#fdfcfb] to-[#e2d1c3] px-4">
      <Card className="w-full max-w-lg shadow-xl border-0 glass-morphism">
        <CardHeader className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-2 top-2"
            aria-label="Back"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <CardTitle className="text-center">Book a Ticket</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Booking form will go here */}
          <p className="text-gray-600 dark:text-gray-300 text-center mb-4">
            Ticket booking functionality coming soon!
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default BookTicket;
