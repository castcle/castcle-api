import { CommonDate } from './date';

describe('date', () => {
  it('should work', () => {
    const dt = new CommonDate();
    const date = dt.getDateFromString('19811110', 'YYYY/MM/DD');
    expect(dt.getDateFormat(date, 'DD/MM/YYYY')).toEqual('10/11/1981');
    expect(dt.getDateFormat(dt.addDate(date, 1, 0, 0), 'DD/MM/YYYY')).toEqual(
      '11/11/1981'
    );
    expect(
      dt.getDateFormat(dt.addDate(date, 1, 5, 30), 'YYYY-MM-DDTHH:mm:ss')
    ).toEqual('1981-11-11T05:30:00');
    expect(
      dt.getDateFormat(dt.addMonth(date, 1), 'YYYY-MM-DDTHH:mm:ss')
    ).toEqual('1981-12-10T00:00:00');
    expect(
      dt.getDateFormat(dt.addMonth(date, 2), 'YYYY-MM-DDTHH:mm:ss')
    ).toEqual('1982-01-10T00:00:00');
    expect(
      dt.getDateFormat(dt.addYear(date, 5), 'YYYY-MM-DDTHH:mm:ss')
    ).toEqual('1986-11-10T00:00:00');
  });
});
