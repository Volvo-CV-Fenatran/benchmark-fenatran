/* Questionário FENATRAN. Edite este arquivo para mudar perguntas, escala ou veículos sugeridos.
   Ao mudar perguntas, aumente "version" para não misturar respostas antigas com novas. */
window.QUESTIONNAIRE = {
  version: "v3",
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
    roles: ["Feature Engineer", "Product Development Engineer", "Manager", "Project Manager", "Vehicle Architect"]
  },
  sections: [
    { id: "chassi_suspensos", label: "Robustez e qualidade das soluções do chassi e elementos suspensos (tanques, travessas, caixa de bateria, etc.)" },
    { id: "cabos_linhas_conectores", label: "Qualidade da instalação dos cabos, linhas pneumáticas e conectores" },
    { id: "cab_folgas_alinhamentos", label: "Impressão de qualidade da cabine: folgas e alinhamentos entre painéis (gaps and flushes)" },
    { id: "instalacao_suspensoes", label: "Instalação das suspensões (dianteira, traseira e de cabine)" },
    { id: "acesso_cabine", label: "Conforto ao Entrar e Sair do Veículo" },
    { id: "impressao_interior", label: "Impressão Geral do Interior da Cabine" },
    { id: "banco_motorista_passageiro", label: "Banco do Motorista e Passageiro" },
    { id: "ajustes_direcao", label: "Ajustes de Direção" },
    { id: "itens_conveniencia_internos", label: "Itens de Conveniência Internos (ar condicionado, climatizador, geladeira, etc.)" },
    { id: "cama", label: "Cama" },
    { id: "espaco_cabine", label: "Espaço na Cabine e Facilidade de Movimentação Interna" },
    { id: "armazenamento_interno", label: "Espaço de Armazenamento Interno" },
    { id: "tela_multimidia", label: "Tela Multimídia" }
  ]
};
