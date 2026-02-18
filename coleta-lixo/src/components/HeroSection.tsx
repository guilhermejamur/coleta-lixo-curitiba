import { MapPin, Recycle, Trash2, Navigation } from "lucide-react";
import SearchBar from "./SearchBar";
import { useState } from "react";

interface HeroSectionProps {
  onSearch: (lat: number, lng: number, displayName: string) => void;
  isLoading: boolean;
}

const HeroSection = ({ onSearch, isLoading }: HeroSectionProps) => {
  const [geoLoading, setGeoLoading] = useState(false);

  const handleGeolocation = () => {
    if (!navigator.geolocation) return;
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`
          );
          const data = await res.json();
          onSearch(latitude, longitude, data.display_name || `${latitude}, ${longitude}`);
        } catch {
          onSearch(latitude, longitude, `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
        } finally {
          setGeoLoading(false);
        }
      },
      () => setGeoLoading(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <section className="relative pt-8 pb-10 px-4 overflow-hidden">
      <div className="absolute inset-0 gradient-subtle opacity-60" />
      <div className="absolute top-20 right-10 opacity-10">
        <Recycle className="h-48 w-48 text-primary" />
      </div>

      <div className="relative container mx-auto max-w-3xl text-center">
        {/* Logos */}
        <div className="flex items-center justify-center gap-6 sm:gap-10 mb-6">
          <img
            src="/images/prefeitura-curitiba.png"
            alt="Prefeitura de Curitiba"
            className="h-16 sm:h-20 w-auto" />

          <div className="h-12 w-px bg-border" />
          <img
            src="/images/logo-estre.png"
            alt="Estre - Lixo é só o começo"
            className="h-12 sm:h-16 w-auto" />

        </div>




        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-foreground leading-tight mb-3">
          Consulte o horário da{" "}
          <span className="text-primary">coleta de lixo</span>
          <br />
          do seu endereço
        </h1>

        <p className="text-base sm:text-lg text-muted-foreground mb-6 max-w-xl mx-auto">
          Descubra os dias e horários da coleta domiciliar e seletiva na sua região em Curitiba.
        </p>

        <SearchBar onSearch={onSearch} isLoading={isLoading} />

        {/* Geolocation button */}
        <button
          onClick={handleGeolocation}
          disabled={geoLoading || isLoading}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-secondary px-5 py-2.5 text-sm font-semibold text-secondary-foreground hover:bg-secondary/90 transition-colors disabled:opacity-50">

          <Navigation className="h-4 w-4" />
          {geoLoading ? "Localizando..." : "Usar minha localização"}
        </button>

        <div className="flex items-center justify-center gap-6 mt-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-primary" />
            <span>Coleta Comum</span>
          </div>
          <div className="flex items-center gap-2">
            <Recycle className="h-4 w-4 text-info" />
            <span>Coleta Seletiva</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-warning" />
            <span>Sua Localização</span>
          </div>
        </div>
      </div>
    </section>);

};

export default HeroSection;