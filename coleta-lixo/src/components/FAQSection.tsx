import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { HelpCircle } from "lucide-react";

const faqs = [
  {
    question: "Como descartar vidros e materiais cortantes?",
    answer:
      "Vidros e materiais cortantes devem ser embalados em papel grosso (como jornal) ou caixa de papelão e identificados com a inscrição 'VIDRO' ou 'CORTANTE'. Nunca descarte esses materiais em sacolas plásticas comuns, pois podem causar acidentes aos coletores.",
  },
  {
    question: "Qual o horário limite para colocar o lixo na calçada?",
    answer:
      "O lixo deve ser colocado na calçada com no máximo 1 hora de antecedência ao horário previsto para a passagem do caminhão. Evite colocar o lixo muito cedo para não causar problemas de higiene e mau cheiro na vizinhança.",
  },
  {
    question: "O que fazer se o caminhão não passar?",
    answer:
      "Caso o caminhão de coleta não passe no horário previsto, aguarde até o final do dia. Se a coleta não for realizada, entre em contato com a Central de Atendimento 156 da Prefeitura de Curitiba para registrar uma reclamação e solicitar a coleta pendente.",
  },
  {
    question: "O que pode ser reciclado na Coleta Seletiva?",
    answer:
      "Podem ser reciclados: papéis (jornais, revistas, caixas), plásticos (garrafas PET, embalagens), metais (latas de alumínio, latas de aço) e vidros (garrafas, potes). Lembre-se de lavar as embalagens antes de descartá-las para reciclagem.",
  },
  {
    question: "Como descartar lixo eletrônico?",
    answer:
      "Lixo eletrônico como pilhas, baterias, celulares e computadores não devem ser descartados na coleta comum. Leve esses materiais aos pontos de coleta específicos, como os Ecopontos espalhados pela cidade ou nos locais de entrega voluntária.",
  },
  {
    question: "Como descartar seringas e agulhas?",
    answer:
      "Seringas e agulhas devem ser colocadas em recipientes rígidos e resistentes a perfuração, como garrafas PET grossas ou caixas coletoras específicas. Nunca descarte esses materiais no lixo comum ou reciclável. Leve aos postos de saúde, farmácias ou Unidades de Saúde mais próximas que possuem pontos de coleta para materiais perfurocortantes.",
  },
  {
    question: "Como descartar remédios vencidos ou em desuso?",
    answer:
      "Remédios vencidos ou em desuso não devem ser jogados no lixo comum nem no vaso sanitário, pois contaminam o solo e a água. Leve-os até uma farmácia ou Unidade de Saúde que possua ponto de coleta de medicamentos. Mantenha os remédios nas embalagens originais para facilitar a identificação.",
  },
  {
    question: "Como descartar resíduos hospitalares?",
    answer:
      "Resíduos hospitalares como curativos, gazes, luvas e materiais contaminados com sangue ou secreções devem ser embalados em sacos brancos leitosos e identificados com o símbolo de risco biológico. Esses materiais não vão na coleta comum. Entre em contato com a Secretaria Municipal de Saúde pelo 156 para orientações sobre o descarte correto ou procure uma Unidade de Saúde.",
  },
];

const FAQSection = () => {
  return (
    <section className="container mx-auto px-4 mb-16">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
            <HelpCircle className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Dúvidas Frequentes</h2>
            <p className="text-sm text-muted-foreground">Encontre respostas rápidas</p>
          </div>
        </div>

        <Accordion type="single" collapsible className="space-y-3">
          {faqs.map((faq, i) => (
            <AccordionItem
              key={i}
              value={`faq-${i}`}
              className="bg-card rounded-2xl border border-border shadow-soft px-6 data-[state=open]:shadow-medium transition-shadow"
            >
              <AccordionTrigger className="text-sm font-semibold text-foreground hover:no-underline py-4">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground pb-4 leading-relaxed">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
};

export default FAQSection;
