declare const __brand: unique symbol;
type Brand<T, B> = T & { [__brand]: B };

export type ActiveId = Brand<number, 'ActiveId'>;

export enum TimeFrame {
  S1 = 1,
  S5 = 5,
  S10 = 10,
  S15 = 15,
  S30 = 30,
  M1 = 60,
  M5 = 300,
  M15 = 900,
  M30 = 1800,
  H1 = 3600,
  H4 = 14400,
  D1 = 86400,
}

export enum Direction {
  Call = 'call',
  Put = 'put',
}

export enum AccountType {
  Practice = 'PRACTICE',
  Real = 'REAL',
}
