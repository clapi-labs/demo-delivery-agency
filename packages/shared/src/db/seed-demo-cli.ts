import { seedDemo } from "./seed-demo";

seedDemo()
  .then(() => {
    console.log("Listo.");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
