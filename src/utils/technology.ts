export interface TechnologyConfigItem {
  name: string;
  kline_interval: string;
  period: number | string;
  multiplier?: number | string;
  std_dev_multiplier?: number | string;
  enable: boolean;
}

export interface TechnologyValidationIssue {
  key: string;
  params?: Record<string, string | number>;
}

const indicatorNamePattern = /^[A-Za-z_][A-Za-z0-9_]*$/;

const reservedIndicatorNames = new Set([
  "SystemStartTime",
  "MarketCondition",
  "NowTime",
  "NowPrice",
  "NowSymbolPercentChange",
  "NowSymbolClose",
  "NowSymbolOpen",
  "NowSymbolLow",
  "NowSymbolHigh",
  "BasicTrend",
  "Kdj",
  "IsAsc",
  "IsDesc",
  "ROI",
  "Position",
  "Positions",
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "BNBUSDT"
]);

export function validateTechnologyConfig(
  config: Record<string, TechnologyConfigItem[]>
): TechnologyValidationIssue | null {
  const usedNames = new Set<string>();

  for (const [indicatorType, items] of Object.entries(config)) {
    for (const item of items) {
      if (!item.enable) continue;

      const name = item.name;
      if (!name) {
        return {
          key: "nameRequired",
          params: { indicator: indicatorType.toUpperCase() }
        };
      }
      if (name !== name.trim() || !indicatorNamePattern.test(name)) {
        return { key: "nameInvalid", params: { name } };
      }
      if (reservedIndicatorNames.has(name) || name.startsWith("kline_")) {
        return { key: "nameReserved", params: { name } };
      }
      if (usedNames.has(name)) {
        return { key: "nameDuplicate", params: { name } };
      }
      usedNames.add(name);

      if (!item.kline_interval) {
        return { key: "intervalRequired", params: { name } };
      }

      const period = Number(item.period);
      const maximumPeriod = indicatorType === "rsi" ? 149 : 150;
      if (!Number.isInteger(period) || period < 1 || period > maximumPeriod) {
        return {
          key: "periodInvalid",
          params: { name, maximum: maximumPeriod }
        };
      }

      if (
        indicatorType === "kc" &&
        (!Number.isFinite(Number(item.multiplier)) ||
          Number(item.multiplier) < 0)
      ) {
        return { key: "multiplierInvalid", params: { name } };
      }
      if (
        indicatorType === "boll" &&
        (!Number.isFinite(Number(item.std_dev_multiplier)) ||
          Number(item.std_dev_multiplier) < 0)
      ) {
        return { key: "stdDevMultiplierInvalid", params: { name } };
      }
    }
  }

  return null;
}
