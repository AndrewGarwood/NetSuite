/**
 * @file Accounting.d.ts
 * @description TypeScript definitions for Accounting fields in NetSuite.
 * @module Accounting
 */
import { RecordRef } from './Record';
export type ItemAccountingBookDetail = {
    accountingBook?: RecordRef;
    amortizationTemplate?: RecordRef;
}
/*
Name	Type	Cardinality	Label	Required	Help
accountingBook	RecordRef	0..1			
amortizationTemplate	RecordRef	0..1	Amortization Template	F	
createRevenuePlansOn	RecordRef	0..1	Create Revenue Plans On	F	
revenueRecognitionRule	RecordRef	0..1	Revenue Recognition Rule	T	
revRecForecastRule	RecordRef	0..1	Rev Rec Forecast Rule	T	
revRecSchedule	RecordRef	0..1	Revenue Recognition Template	F	
sameAsPrimaryAmortization	boolean	0..1			
sameAsPrimaryRevRec	boolean	0..1			
*/