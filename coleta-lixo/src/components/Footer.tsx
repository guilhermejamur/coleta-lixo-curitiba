import { ExternalLink, Phone } from "lucide-react";

const Footer = () => {
  return (
    <footer className="border-t border-border bg-card">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          {/* 156 Highlight */}
          <div className="bg-accent rounded-2xl p-6 border border-border">
            <p className="text-4xl font-extrabold text-primary mb-1">156</p>
            <p className="text-sm font-semibold text-foreground mb-2">
              Central de Atendimento ao Cidadão
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              Ligue ou acesse o canal digital para dúvidas, reclamações ou solicitações sobre a coleta de lixo.
            </p>
            <a
              href="https://central156.curitiba.pr.gov.br/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Phone className="h-4 w-4" />
              Acessar Canal de Atendimento
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4 text-xs text-muted-foreground">
            <span>© 2026 Prefeitura Municipal de Curitiba</span>
            <span className="hidden sm:inline">•</span>
            <span>Concessionária Estre — Serviços de Limpeza Urbana</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
