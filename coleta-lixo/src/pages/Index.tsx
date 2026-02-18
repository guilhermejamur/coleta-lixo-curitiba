import { useState, useCallback, useMemo } from "react";
import HeroSection from "@/components/HeroSection";
import MapView from "@/components/MapView";
import ResultsCard from "@/components/ResultsCard";
import FAQSection from "@/components/FAQSection";
import Footer from "@/components/Footer";
import type { ColetaInfo } from "@/components/MapView";

const Index = () => {
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [address, setAddress] = useState("");
  const [results, setResults] = useState<ColetaInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = useCallback((newLat: number, newLng: number, displayName: string) => {
    setIsLoading(true);
    setLat(newLat);
    setLng(newLng);
    setAddress(displayName);
    setHasSearched(true);
    setTimeout(() => setIsLoading(false), 500);
  }, []);

  const handleResult = useCallback((newResults: ColetaInfo[]) => {
    setResults(newResults);
    setIsLoading(false);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <main className="flex-1">
        <HeroSection onSearch={handleSearch} isLoading={isLoading} />

        {hasSearched && results.length > 0 && (
          <ResultsCard results={results} address={address} />
        )}

        {hasSearched && results.length === 0 && !isLoading && (
          <div className="container mx-auto px-4 mb-8 animate-slide-up">
            <div className="max-w-3xl mx-auto text-center bg-card rounded-2xl shadow-soft border border-border p-8">
              <p className="text-sm font-medium text-foreground mb-1">
                Nenhuma área de coleta encontrada
              </p>
              <p className="text-xs text-muted-foreground">
                O endereço informado não está dentro de uma área de coleta mapeada. Tente outro endereço ou entre em contato pelo 156.
              </p>
            </div>
          </div>
        )}

        <MapView lat={lat} lng={lng} onResult={handleResult} />

        <FAQSection />
      </main>

      <Footer />
    </div>
  );
};

export default Index;
