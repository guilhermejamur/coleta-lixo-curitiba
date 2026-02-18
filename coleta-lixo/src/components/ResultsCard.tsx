import { Trash2, Recycle, Clock, CalendarDays, MapPin } from "lucide-react";
import type { ColetaInfo } from "./MapView";

interface ResultsCardProps {
  results: ColetaInfo[];
  address: string;
}

const ResultsCard = ({ results, address }: ResultsCardProps) => {
  if (results.length === 0) return null;

  // Group by operation type
  const seletiva = results.filter((r) => r.operacao.includes("LIXO QUE NÃO É LIXO"));
  const domiciliar = results.filter((r) => !r.operacao.includes("LIXO QUE NÃO É LIXO"));

  const bairro = results[0]?.bairro || "N/A";
  const setor = results[0]?.setor || "N/A";

  const turnoLabel = (turno: string) => {
    if (turno.includes("DIURNO")) return "Manhã";
    if (turno.includes("NOTURNO")) return "Noite";
    if (turno.includes("VESPERTINO")) return "Tarde";
    return turno;
  };

  return (
    <div className="container mx-auto px-4 mb-12 animate-slide-up">
      <div className="max-w-3xl mx-auto">
        {/* Address header */}
        <div className="flex items-start gap-3 mb-4 px-1">
          <MapPin className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-foreground">Resultado da consulta</p>
            <p className="text-xs text-muted-foreground line-clamp-2">{address}</p>
          </div>
        </div>

        {/* Region info */}
        <div className="bg-card rounded-2xl shadow-soft border border-border p-6 mb-4">
          <div className="flex flex-wrap gap-3 mb-6">
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
              Bairro: {bairro}
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Coleta Seletiva */}
            {seletiva.length > 0 && (
              <div className="rounded-xl border border-border p-4 bg-accent/30">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center">
                    <Recycle className="h-4 w-4 text-secondary-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">Coleta Seletiva</p>
                    <p className="text-xs text-muted-foreground">Lixo Que Não É Lixo</p>
                  </div>
                </div>
                {seletiva.map((item, i) => (
                  <div key={i} className="space-y-1.5 mt-2">
                    <div className="flex items-center gap-2 text-sm">
                      <CalendarDays className="h-3.5 w-3.5 text-info" />
                      <span className="font-medium text-foreground">{item.frequencia}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-3.5 w-3.5 text-info" />
                      <span className="text-muted-foreground">
                        {turnoLabel(item.turno)} — {item.horario}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Coleta Domiciliar placeholder */}
            {domiciliar.length > 0 ? (
              <div className="rounded-xl border border-border p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">Coleta Resíduo Comum</p>
                    <p className="text-xs text-muted-foreground">Lixo Comum</p>
                  </div>
                </div>
                {domiciliar.map((item, i) => (
                  <div key={i} className="space-y-1.5 mt-2">
                    <div className="flex items-center gap-2 text-sm">
                      <CalendarDays className="h-3.5 w-3.5 text-primary" />
                      <span className="font-medium text-foreground">{item.frequencia}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-3.5 w-3.5 text-primary" />
                      <span className="text-muted-foreground">
                        {turnoLabel(item.turno)} — {item.horario}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-border p-4 flex flex-col items-center justify-center text-center">
                <Trash2 className="h-6 w-6 text-muted-foreground mb-2" />
                <p className="text-sm font-medium text-foreground">Coleta Resíduo Comum</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Dados não disponíveis para esta região no momento.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResultsCard;
