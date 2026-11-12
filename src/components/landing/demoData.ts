/** Fictional, self-contained data for the landing page live demo. */

export type DemoCase = {
  code: string;
  title: string;
  steps: string[];
  expected: string[];
  /** Pre-filled failure note when the visitor marks this case Fail. */
  failNote: string;
  /** What the agent edits when this case comes back failed. */
  fix: { file: string; result: string };
};

export type DemoSection = { code: string; title: string; cases: DemoCase[] };

export const PLAN_TITLE = "Coupon codes at checkout";
export const PLAN_BRANCH = "feature/checkout-coupons";
export const PLAN_COMMIT = "a41c9e2";

export const SECTIONS: DemoSection[] = [
  {
    code: "S",
    title: "Setup",
    cases: [
      {
        code: "S1",
        title: "Seed an active and an expired coupon",
        steps: ["Run `npm run coupons:seed`", "Open `/admin/coupons`"],
        expected: ["`SAVE10` is active, 10% off", "`OLD5` is listed as expired"],
        failNote: "OLD5 shows as active — expiry date wasn't saved.",
        fix: { file: "scripts/seed-coupons.ts", result: "Seeds OLD5 with an expiry in the past" },
      },
    ],
  },
  {
    code: "C",
    title: "Checkout",
    cases: [
      {
        code: "C1",
        title: "Valid code applies the discount",
        steps: ["Add any item, open `/checkout`", "Enter `SAVE10`, press Apply"],
        expected: ["A `Coupon SAVE10 −10%` line appears", "Order total drops by 10%"],
        failNote: "Coupon line shows, but the total only updates after a refresh.",
        fix: { file: "src/checkout/useCartTotals.ts", result: "Totals recompute when a coupon is applied" },
      },
      {
        code: "C2",
        title: "Expired code shows an error",
        steps: ["Enter `OLD5`, press Apply"],
        expected: ["Inline error `This code has expired`", "Total is unchanged"],
        failNote: "Expired code was accepted, no error shown.",
        fix: { file: "src/checkout/applyCoupon.ts", result: "Expired codes return \"This code has expired\"" },
      },
      {
        code: "C3",
        title: "Codes can't be stacked",
        steps: ["Apply `SAVE10`", "Then apply `FREESHIP`"],
        expected: ["Second code is rejected: `Only one code per order`", "`SAVE10` stays applied"],
        failNote: "Second code replaced the first instead of being rejected.",
        fix: { file: "src/checkout/applyCoupon.ts", result: "Rejects a second coupon with \"Only one code per order\"" },
      },
      {
        code: "C4",
        title: "Discount survives a page refresh",
        steps: ["Apply `SAVE10`", "Reload `/checkout`"],
        expected: ["Coupon line and discounted total are still shown"],
        failNote: "Discount disappears after reload.",
        fix: { file: "src/checkout/cartSession.ts", result: "Coupon is stored on the cart session" },
      },
    ],
  },
];

export const CASES: DemoCase[] = SECTIONS.flatMap((s) => s.cases);
