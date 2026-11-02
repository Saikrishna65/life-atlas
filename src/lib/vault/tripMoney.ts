import type {IUnitOfWork} from '../finance/storage/interfaces';
import {TransactionService} from '../finance/application/transactionService';
import {rupeesToPaise} from '../finance/domain/money';
import type {ExpenseRecord,TripRecord} from './types';
import {getAllTrips} from './storage';
export const savedExpenseId=(expense:ExpenseRecord)=>`atlas-trip-expense:${expense.tripId}:${expense.id}`;
/** Explicitly reviewed transfer; originals stay in Trip Vault for recovery. */
export async function linkSavedTripExpense(uow:IUnitOfWork,trip:TripRecord,expense:ExpenseRecord,accountId:string){
 if(expense.tripId!==trip.id)throw Error('This expense belongs to another trip.');
 if(expense.isDeposit)throw Error('Manage saved deposits and refunds in the previous records view.');
 if(expense.currency!==trip.currency)throw Error('The saved expense and trip currencies must match.');
 const account=await uow.accounts.getById(accountId);if(!account||account.status!=='active'||account.currency!==expense.currency)throw Error('Choose an active account with the same currency.');
 const amountPaise=rupeesToPaise(expense.amount),externalId=savedExpenseId(expense),previous=await uow.transactions.getByExternalId(externalId);
 if(previous){if(previous.amountPaise!==amountPaise||previous.accountId!==accountId||previous.currency!==expense.currency)throw Error('This saved expense is already linked with different details. Review its Finance payment.');return previous;}
 return new TransactionService(uow,getAllTrips).recordTransaction({accountId,description:expense.title,amountPaise,currency:expense.currency,direction:'outflow',occurredAt:expense.date,source:'manual',externalId,notes:expense.notes,tripAssignment:{mode:'manual',tripId:trip.id,tripTitle:trip.title}});
}
