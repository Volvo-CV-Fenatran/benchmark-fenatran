/* Questionário FENATRAN. Edite este arquivo para mudar perguntas, escala ou veículos sugeridos.
   Ao mudar perguntas, aumente "version" para não misturar respostas antigas com novas. */
window.QUESTIONNAIRE = {
  version: "draft-1",
  // ESCALA ASSUMIDA (1-5 + N/A). Confirmar com o formulário original do MS Forms.
  scale: {
    min: 1,
    max: 5,
    labels: { 1: "Muito ruim", 2: "Ruim", 3: "Regular", 4: "Bom", 5: "Excelente" }
  },
  brands: ["Volvo", "Mercedes-Benz", "Scania", "DAF", "Iveco", "MAN", "Outra"],
  vehicles: [
    { brand: "Volvo", model: "FH 540 6x4" },
    { brand: "Mercedes-Benz", model: "2651 New Actros 6x4" },
    { brand: "Scania", model: "R 540 6x4" }
  ],
  profile: {
    areas: ["Feature Leader", "Product Development Engineer", "Manager"]
  },
  sections: [
    { id: "armazenamento_externo", label: "Espaço de Armazenamento Externo" },
    { id: "acesso_cabine", label: "Conforto ao Entrar e Sair do Veículo" },
    { id: "impressao_interior", label: "Impressão Geral do Interior da Cabine" },
    { id: "qualidade_acabamento", label: "Impressão de Qualidade (Acabamento)" },
    { id: "banco_motorista", label: "Banco do Motorista" },
    { id: "ajustes_direcao", label: "Ajustes de Direção" },
    { id: "cintos", label: "Cintos de Segurança" },
    { id: "teto_escotilha", label: "Teto Solar e Escotilha" },
    { id: "ar_condicionado", label: "Ar Condicionado e Climatizador" },
    { id: "cama", label: "Cama" },
    { id: "espaco_cabine", label: "Espaço na Cabine e Facilidade de Movimentação Interna" },
    { id: "armazenamento_interno", label: "Espaço de Armazenamento Interno" },
    { id: "computador_bordo", label: "Computador de Bordo" },
    { id: "tela_multimidia", label: "Tela Multimídia" },
    { id: "navegacao_gps", label: "Navegação (GPS)" }
  ]
};
