export function printSpacingBetweenPrompts() {
  consola.log(`\n`);
}

export function promptErrorHandler(promptError) {
  consola.error('Error reading answer.', promptError);
}
