describe('workspace loads', () => {
  it('should contain POS Awesome workspace', () => {
    cy.visit('/app');
    cy.contains('POS Awesome');
  });
});
