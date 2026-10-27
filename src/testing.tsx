// @quonfig/react/testing (2.0.0, qfg-qqkf): the test double lives on its own
// entry so it, and the duration parsing it does, stay out of the production
// bundle. It shares QuonfigProvider's context through a common chunk, so
// useQuonfig / useFlag imported from "@quonfig/react" see this provider.
import { QuonfigTestProvider, QuonfigTestProviderProps } from "./QuonfigTestProvider";

export { QuonfigTestProvider, QuonfigTestProviderProps };
