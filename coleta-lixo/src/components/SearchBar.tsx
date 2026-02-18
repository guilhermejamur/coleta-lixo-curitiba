import { useState, useRef, useEffect } from "react";
import { Search, Loader2, MapPin } from "lucide-react";

interface SearchResult {
  display_name: string;
  lat: string;
  lon: string;
}

interface SearchBarProps {
  onSearch: (lat: number, lng: number, displayName: string) => void;
  isLoading: boolean;
}

const SearchBar = ({ onSearch, isLoading }: SearchBarProps) => {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Remove prefixes like "rua", "avenida", "alameda" and honorifics for better matching
  const normalizeQuery = (q: string) => {
    return q
      .replace(/^(rua|r\.|av\.|avenida|alameda|al\.|travessa|tv\.|praça|pç\.|rodovia|rod\.|estrada|est\.)\s+/i, "")
      .replace(/^(professor|prof\.|professora|profa\.|doutor|doutora|dr\.|dra\.|presidente|pres\.|senador|sen\.|deputado|dep\.|general|gen\.|marechal|mal\.|coronel|cel\.|capitão|cap\.|tenente|ten\.|engenheiro|eng\.|padre|pe\.|frei|dom|santa|santo|são|nossa senhora de|nossa senhora)\s+/i, "")
      .trim();
  };

  const formatDisplayName = (r: any): string => {
    const addr = r.address || {};
    const parts: string[] = [];
    
    // Street name with number
    const road = addr.road || "";
    const houseNumber = addr.house_number || "";
    if (road) {
      parts.push(houseNumber ? `${road}, ${houseNumber}` : road);
    }
    
    // Neighbourhood
    const neighbourhood = addr.suburb || addr.neighbourhood || addr.quarter || "";
    if (neighbourhood) parts.push(neighbourhood);
    
    // City
    parts.push("Curitiba");
    
    return parts.join(" - ");
  };

  // Extract house number from query string
  const extractNumber = (q: string): { street: string; number: string } => {
    // Match number at end or after comma: "carlos de carvalho 1555" or "carlos de carvalho, 1555"
    const match = q.match(/^(.+?)[,\s]+(\d+)\s*$/);
    if (match) return { street: match[1].trim(), number: match[2] };
    // Match number at start: "1555 carlos de carvalho"
    const match2 = q.match(/^(\d+)[,\s]+(.+)$/);
    if (match2) return { street: match2[2].trim(), number: match2[1] };
    return { street: q.trim(), number: "" };
  };

  const searchAddress = async (q: string) => {
    if (q.length < 3) {
      setSuggestions([]);
      return;
    }
    setSearching(true);
    try {
      const { street: rawStreet, number: houseNumber } = extractNumber(q);
      
      // Try with original street first, then normalized
      const streets = [rawStreet];
      const normalized = normalizeQuery(rawStreet);
      if (normalized !== rawStreet) streets.push(normalized);

      let allResults: any[] = [];
      for (const streetQuery of streets) {
        const streetParam = houseNumber ? `${houseNumber} ${streetQuery}` : streetQuery;
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&street=${encodeURIComponent(streetParam)}&city=Curitiba&state=Paran%C3%A1&country=Brasil&limit=10&addressdetails=1&bounded=1&viewbox=-49.45,-25.25,-49.10,-25.65`
        );
        const data = await res.json();
        // Inject the user-provided house number into results
        if (houseNumber) {
          data.forEach((r: any) => {
            if (r.address && !r.address.house_number) {
              r.address.house_number = houseNumber;
            }
          });
        }
        allResults = [...allResults, ...data];
        if (allResults.length >= 5) break;
      }

      // Deduplicate by place_id
      const seen = new Set<string>();
      const unique = allResults.filter((r: any) => {
        if (seen.has(r.place_id?.toString())) return false;
        seen.add(r.place_id?.toString());
        return true;
      });

      const filtered = unique.filter((r: any) => {
        const addr = r.address;
        return addr && (
          addr.city === "Curitiba" ||
          addr.town === "Curitiba" ||
          addr.municipality === "Curitiba" ||
          (r.display_name && r.display_name.includes("Curitiba"))
        );
      }).slice(0, 5).map((r: any) => ({
        ...r,
        display_name: formatDisplayName(r),
      }));

      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } catch {
      setSuggestions([]);
    } finally {
      setSearching(false);
    }
  };

  const handleInputChange = (value: string) => {
    setQuery(value);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => searchAddress(value), 400);
  };

  const handleSelect = (result: SearchResult) => {
    setQuery(result.display_name);
    setShowSuggestions(false);
    onSearch(parseFloat(result.lat), parseFloat(result.lon), result.display_name);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (suggestions.length > 0) {
      handleSelect(suggestions[0]);
    }
  };

  return (
    <div ref={wrapperRef} className="relative max-w-2xl mx-auto">
      <form onSubmit={handleSubmit}>
        <div className="relative flex items-center rounded-2xl bg-card shadow-medium border border-border overflow-hidden transition-all focus-within:ring-2 focus-within:ring-primary/30">
          <MapPin className="absolute left-4 h-5 w-5 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="Digite seu endereço em Curitiba..."
            className="w-full pl-12 pr-14 py-4 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none text-base"
          />
          <button
            type="submit"
            disabled={isLoading || searching}
            className="absolute right-2 h-10 w-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isLoading || searching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </button>
        </div>
      </form>

      {showSuggestions && (
        <div className="absolute top-full left-0 right-0 mt-2 rounded-2xl bg-card shadow-medium border border-border overflow-hidden z-10 animate-fade-in">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => handleSelect(s)}
              className="w-full px-4 py-3 text-left text-sm text-foreground hover:bg-accent transition-colors flex items-start gap-3"
            >
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <span className="line-clamp-2">{s.display_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
