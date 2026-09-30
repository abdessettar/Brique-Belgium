/**
 * The one place the 2025 Belgian registration duty rules and the mortgage arithmetic live.
 *
 * Pure JS, no data, no DOM, no npm: imports, so it runs under node as well as in the browser:
 *   node src/components/duty.js   prints a few worked examples.
 *
 * Used by the Affordability page for the notary's statement (registrationDuty, notaryEstimate,
 * mortgage) and the rent-or-buy figure (rentVsBuy, rentVsBuyBand, crossing).
 *
 * Every rule below is the mainstream 2025 case for a private buyer of an existing home. Special
 * regimes (renovation rebates, protected monuments, social housing, portability of earlier duty,
 * professional buyers, the Flemish 1 percent energy renovation rate that ended in 2024) are not
 * encoded. The duty descriptions state the mainstream rule only; the notary line says "estimate";
 * the page prints "Rules as of 1 January 2025" and the new build exclusion beside the statement.
 */

import {eur, pctWord} from "./sentences.js";

export const RULES_AS_OF = "1 January 2025";

/** Canonical region keys accepted by registrationDuty, with the aliases pages tend to pass. */
const REGION_KEYS = {
  flanders: "flanders", vlaanderen: "flanders", "vlaams gewest": "flanders", fl: "flanders", vl: "flanders",
  wallonia: "wallonia", wallonie: "wallonia", "région wallonne": "wallonia", "region wallonne": "wallonia", wa: "wallonia", wal: "wallonia",
  brussels: "brussels", bruxelles: "brussels", brussel: "brussels", "brussels-capital": "brussels", bru: "brussels", bxl: "brussels"
};

const normaliseRegion = (region) => REGION_KEYS[String(region ?? "").trim().toLowerCase()] ?? null;

const round = (v) => Math.round(v);
const r2 = (v) => Math.round(v * 100) / 100;

/**
 * Registration duty (registratierechten / droits d'enregistrement) on an existing home.
 *
 * registrationDuty(price, {region, mainHome = true, newBuild = false})
 *   region:   "flanders" | "wallonia" | "brussels" (Dutch and French spellings and short codes accepted)
 *   mainHome: the buyer's sole own home, with domicile taken within the regional deadline
 *   newBuild: true returns {excluded: true, description} since new build carries 21 percent VAT instead
 *
 * Returns {amount, rate, base, region, mainHome, description} where rate is a percent (2, 3, 12, 12.5),
 * base is the amount the rate applies to (after the Brussels abattement) and description is a sentence
 * fragment ready to print as the line's description, for example
 *   "Flanders, sole main home with domicile within three years: 2 percent on €399,000".
 *
 * Sources (rules in force on 1 January 2025):
 *   Flanders: Vlaamse Codex Fiscaliteit art. 2.9.4.2.11 and art. 2.9.4.1.1. The reduced rate for the
 *     sole own home (enige eigen woning) fell from 3 to 2 percent for deeds from 1 January 2025 (Flemish
 *     Programme Decree of 20 December 2024). The buyer may own no other home at signing and must take
 *     domicile within three years. The general rate is 12 percent.
 *   Wallonia: Code des droits d'enregistrement (Walloon version) art. 44 and the new art. 53quinquies
 *     inserted by the Walloon decree of 12 December 2024. From 1 January 2025 the sole own home with
 *     domicile within three years pays a flat 3 percent; the former abattement on the first tranche and
 *     the chèque habitat tax credit were abolished by the same reform. The general rate is 12.5 percent.
 *   Brussels: Code des droits d'enregistrement (Brussels version) art. 44 and art. 46bis. The general
 *     rate is 12.5 percent; the abattement exempts the first €200,000 (raised from €175,000 on 1 April
 *     2023) for a main home when the price does not exceed €600,000, the buyer owns no other home, takes
 *     domicile within three years and keeps it for five. No reduced rate exists in Brussels.
 *   New build: VAT Code art. 1 §9 and art. 44 §3: a "new" building sold with VAT carries 21 percent on the
 *     construction value; only the land share can fall under registration duty. Excluded here.
 */
export function registrationDuty(price, {region, mainHome = true, newBuild = false} = {}) {
  if (newBuild) {
    return {
      excluded: true,
      amount: null,
      rate: null,
      base: null,
      description: "New build is bought with 21 percent VAT instead of registration duty and is not covered here"
    };
  }
  const key = normaliseRegion(region);
  if (!key) throw new Error(`registrationDuty: unknown region ${JSON.stringify(region)}; use flanders, wallonia or brussels`);
  const p = Math.max(0, +price || 0);

  if (key === "flanders") {
    // Flanders: 2 percent sole own home with domicile within three years, else 12 percent.
    const rate = mainHome ? 2 : 12;
    const base = p;
    const amount = round(base * rate / 100);
    const description = mainHome
      ? `Flanders, sole main home with domicile within three years: ${pctWord(rate, 0)} on ${eur(base)}`
      : `Flanders, general rate (not the sole own home): ${pctWord(rate, 0)} on ${eur(base)}`;
    return {amount, rate, base, region: key, mainHome, description};
  }

  if (key === "wallonia") {
    // Wallonia: 3 percent sole own home from 1 January 2025 (abattement and chèque habitat abolished),
    // else 12.5 percent.
    const rate = mainHome ? 3 : 12.5;
    const base = p;
    const amount = round(base * rate / 100);
    const description = mainHome
      ? `Wallonia, sole main home with domicile within three years: ${pctWord(rate, 0)} on ${eur(base)}`
      : `Wallonia, general rate (not the sole own home): ${pctWord(rate, 1)} on ${eur(base)}`;
    return {amount, rate, base, region: key, mainHome, description};
  }

  // Brussels: 12.5 percent, first €200,000 exempt for a main home when the price is at most €600,000,
  // domicile within three years, kept for five. Above €600,000 or not a main home: 12.5 percent on the
  // full price.
  const rate = 12.5;
  const ceiling = 600_000;
  const abattement = 200_000;
  const eligible = mainHome && p <= ceiling;
  const base = eligible ? Math.max(0, p - abattement) : p;
  const amount = round(base * rate / 100);
  const description = eligible
    ? `Brussels, main home with domicile within three years kept for five, first ${eur(abattement)} exempt: ${pctWord(rate, 1)} on ${eur(base)}`
    : mainHome
      ? `Brussels, main home above the ${eur(ceiling)} ceiling so no abattement: ${pctWord(rate, 1)} on ${eur(base)}`
      : `Brussels, general rate (not a main home, no abattement): ${pctWord(rate, 1)} on ${eur(base)}`;
  return {amount, rate, base, region: key, mainHome, abattement: eligible ? abattement : 0, description};
}

/**
 * Indicative notary fee, deed costs and VAT on an existing home purchase.
 *
 * notaryEstimate(price) returns {amount, fee, vat, fixed, description}, all rounded to the euro.
 *
 * The statutory notary fee (Royal Decree of 16 December 1950, unchanged tariff, identical in all three
 * regions) is a degressive scale from 4.56 percent on the first €7,500 down to 0.057 percent above
 * €250,095. Over the €150,000 to €700,000 range that scale is within a few percent of the linear
 * approximation used here: €1,500 plus 0.9 percent of the price. VAT at 21 percent applies to the
 * fee. Fixed deed costs (searches, mortgage registry, stamp duty, transcription, administrative
 * disbursements) are taken as a flat €1,200; in practice they run €800 to €1,500 depending on the
 * mortgage deed. This is an estimate, not a quote.
 */
export function notaryEstimate(price) {
  const p = Math.max(0, +price || 0);
  const fee = round(1500 + p * 0.009);
  const vat = round(fee * 0.21);
  const fixed = 1200;
  const amount = fee + vat + fixed;
  const description = `Notary fee estimate (${eur(fee)} on the degressive scale) plus 21 percent VAT (${eur(vat)}) and about ${eur(fixed)} of deed and registry costs`;
  return {amount, fee, vat, fixed, description};
}

/**
 * Monthly annuity repayment for a loan at ratePct percent a year over years, monthly compounding.
 * A zero rate degenerates to a straight division.
 */
export function annuity(loan, ratePct, years) {
  const n = Math.round(years * 12);
  if (n <= 0 || loan <= 0) return 0;
  const i = ratePct / 100 / 12;
  if (i === 0) return loan / n;
  return loan * i / (1 - Math.pow(1 + i, -n));
}

/**
 * The mortgage behind the notary's statement.
 *
 * mortgage({price, depositPct, ratePct, years, duty, fees})
 *   depositPct: the buyer's own money as a percent of the price (the deposit)
 *   ratePct:    annual nominal rate in percent, e.g. 3.4
 *   years:      term in years
 *   duty:       registration duty in euro (from registrationDuty(...).amount)
 *   fees:       notary and deed costs in euro (from notaryEstimate(...).amount)
 *
 * Returns {loan, monthly, cashAtSigning, deposit, totalInterest, totalRepaid, ltv}.
 *
 * Belgian norm: the bank lends against the price only (banks rarely go above 90 percent quotity and
 * the National Bank asks them to stay there), so registration duty and notary costs are paid in cash
 * on top of the deposit. cashAtSigning is therefore deposit + duty + fees and the loan is price minus
 * the deposit; the duty and the fees are never financed here.
 */
export function mortgage({price, depositPct = 10, ratePct = 3.4, years = 25, duty = 0, fees = 0} = {}) {
  const p = Math.max(0, +price || 0);
  const deposit = round(p * depositPct / 100);
  const loan = Math.max(0, p - deposit);
  const monthly = r2(annuity(loan, ratePct, years));
  const n = Math.round(years * 12);
  const totalRepaid = round(monthly * n);
  const totalInterest = Math.max(0, totalRepaid - loan);
  const cashAtSigning = deposit + round(duty || 0) + round(fees || 0);
  const ltv = p > 0 ? r2(100 * loan / p) : 0;
  return {loan, monthly, cashAtSigning, deposit, totalInterest, totalRepaid, ltv};
}

/**
 * Cumulative cost of buying versus renting, year by year.
 *
 * rentVsBuy({price, depositPct, ratePct, years, duty, fees, rent, indexationPct = 2})
 *   rent:          monthly rent in euro at year 0
 *   indexationPct: annual rent indexation in percent (Belgian rents follow the health index; 2 is the
 *                  long run average, 1.5 to 3 the plausible band)
 *
 * Returns [{year, buy, rent}] for year 0..years, where
 *   buy(year)  = cashAtSigning + 12 * monthly * year   (cash out of pocket; no resale value, no upkeep)
 *   rent(year) = sum over the years so far of 12 * rent * (1 + indexationPct/100)^k
 * Both are pure outlays; the figure compares money spent, not wealth built.
 */
export function rentVsBuy({price, depositPct, ratePct, years = 25, duty = 0, fees = 0, rent, indexationPct = 2} = {}) {
  const m = mortgage({price, depositPct, ratePct, years, duty, fees});
  const g = 1 + indexationPct / 100;
  const paths = [];
  let cumRent = 0;
  for (let year = 0; year <= years; year++) {
    if (year > 0) cumRent += 12 * rent * Math.pow(g, year - 1);
    paths.push({year, buy: round(m.cashAtSigning + 12 * m.monthly * year), rent: round(cumRent)});
  }
  return paths;
}

/** First year in which cumulative buy cost is at or below cumulative rent, or null if it never is. */
export function crossing(paths) {
  const hit = paths.find((d) => d.year > 0 && d.buy <= d.rent);
  return hit ? hit.year : null;
}

/**
 * The rent path under a low and a high indexation assumption, for the shaded band on the figure.
 *
 * rentVsBuyBand(opts, [low, high] = [1.5, 3]) returns {low, high, buy, band} where low and high are
 * the full rentVsBuy paths at each indexation, buy is the shared buy path (indexation does not touch
 * it) and band is [{year, buy, rentLow, rentHigh}] ready for an areaY mark.
 */
export function rentVsBuyBand(opts, [lo, hi] = [1.5, 3]) {
  const low = rentVsBuy({...opts, indexationPct: lo});
  const high = rentVsBuy({...opts, indexationPct: hi});
  const band = low.map((d, k) => ({year: d.year, buy: d.buy, rentLow: d.rent, rentHigh: high[k].rent}));
  return {low, high, buy: low.map(({year, buy}) => ({year, buy})), band};
}

/**
 * Everything the notary's statement prints, in one call.
 *
 * statement({price, region, mainHome, newBuild, depositPct, ratePct, years}) returns
 *   {duty, fees, mortgage, total} where duty and fees are the objects above, mortgage the mortgage
 *   result computed with those amounts, and total = price + duty + fees (the all-in cost of the keys).
 * When newBuild is true, duty.excluded is set, duty.amount is null and the mortgage counts no duty.
 */
export function statement({price, region, mainHome = true, newBuild = false, depositPct = 10, ratePct = 3.4, years = 25} = {}) {
  const duty = registrationDuty(price, {region, mainHome, newBuild});
  const fees = notaryEstimate(price);
  const m = mortgage({price, depositPct, ratePct, years, duty: duty.amount ?? 0, fees: fees.amount});
  const total = round(price) + (duty.amount ?? 0) + fees.amount;
  return {duty, fees, mortgage: m, total};
}

// Self-test: node src/components/duty.js
if (typeof process !== "undefined" && process.argv?.[1]?.endsWith("duty.js")) {
  const cases = [
    {label: "Flanders, 399,000, main home", price: 399_000, region: "flanders"},
    {label: "Flanders, 399,000, not the sole own home", price: 399_000, region: "flanders", mainHome: false},
    {label: "Brussels, 450,000, main home", price: 450_000, region: "brussels"},
    {label: "Brussels, 650,000, main home (above the ceiling)", price: 650_000, region: "brussels"},
    {label: "Wallonia, 280,000, main home", price: 280_000, region: "wallonia"},
    {label: "Wallonia, 280,000, new build", price: 280_000, region: "wallonia", newBuild: true}
  ];
  console.log(`Rules as of ${RULES_AS_OF}\n`);
  for (const c of cases) {
    const d = registrationDuty(c.price, c);
    console.log(c.label);
    console.log("  duty:", d.excluded ? "excluded" : eur(d.amount), "|", d.description);
    if (!d.excluded) {
      const f = notaryEstimate(c.price);
      console.log("  fees:", eur(f.amount), "|", f.description);
      const m = mortgage({price: c.price, depositPct: 20, ratePct: 3.4, years: 25, duty: d.amount, fees: f.amount});
      console.log(`  mortgage: loan ${eur(m.loan)}, monthly ${eur(m.monthly)}, cash at signing ${eur(m.cashAtSigning)}, total interest ${eur(m.totalInterest)}`);
    }
    console.log();
  }
  const opts = {price: 399_000, depositPct: 20, ratePct: 3.4, years: 25, duty: 7980, fees: notaryEstimate(399_000).amount, rent: 1300};
  const paths = rentVsBuy(opts);
  console.log("Rent or buy, 399,000 Flanders at 1,300 a month rent, 2 percent indexation");
  for (const y of [0, 1, 5, 10, 15, 20, 25]) console.log(`  year ${y}: buy ${eur(paths[y].buy)}, rent ${eur(paths[y].rent)}`);
  console.log("  crossing year:", crossing(paths));
  const band = rentVsBuyBand(opts);
  console.log("  band at year 25:", eur(band.band[25].rentLow), "to", eur(band.band[25].rentHigh));
  console.log("  crossing low/high:", crossing(band.low), "/", crossing(band.high));
  console.log("\nCheck: annuity on 319,200 at 3.4 percent over 25 years =", annuity(319_200, 3.4, 25).toFixed(2), "(expected about 1,581)");
}
