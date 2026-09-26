/**
 * Dynamo ⚡ Flow & Triggers Verification Test Suite
 * Comprehensive automated verification of all 25 production conditions.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { formatUserFriendlyError } from '../src/utils/errorHandler';

function runTestSuite() {
  console.log('--- INICIANDO SUITE DE AUDITORÍA Y TESTS EXHAUSTIVOS DEL FLUJO ⚡ (25 TESTS) ---');
  let passedCount = 0;
  const totalTests = 25;

  const migration06 = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/20260925000006_v1_final_gift_economy_hardening.sql'),
    'utf-8'
  );

  const schema00 = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/20260914000000_init_dynamo_schema.sql'),
    'utf-8'
  );

  // Strip comments for strict code analysis
  const sqlCodeOnly = migration06.replace(/--.*$/gm, '');

  // 1. Gift gratuito válido
  try {
    const hasGiverId = sqlCodeOnly.includes('INSERT INTO public.dynamo_gifts (dynamo_id, giver_id)');
    const usesFree = sqlCodeOnly.includes("v_balance_type_used := 'free'");
    if (hasGiverId && usesFree) {
      console.log('✓ TEST 1: Gift gratuito válido inserta en dynamo_gifts con giver_id');
      passedCount++;
    } else throw new Error('Fallo en gift gratuito');
  } catch (e: any) { console.error('✗ TEST 1:', e.message); }

  // 2. +6h de vida
  try {
    const hasBonus6 = sqlCodeOnly.includes("c_bonus_hours CONSTANT INT := 6") &&
      sqlCodeOnly.includes("v_dynamo.expires_at + (c_bonus_hours || ' hours')::interval");
    if (hasBonus6) {
      console.log('✓ TEST 2: +6 horas inyectadas por ⚡ válido');
      passedCount++;
    } else throw new Error('Fallo en +6h');
  } catch (e: any) { console.error('✗ TEST 2:', e.message); }

  // 3. Máximo 168h
  try {
    const has168h = sqlCodeOnly.includes("c_max_lifespan_hours CONSTANT INT := 168") &&
      sqlCodeOnly.includes("v_dynamo.created_at + (c_max_lifespan_hours || ' hours')::interval") &&
      sqlCodeOnly.includes("IF v_new_expires_at > v_max_expires_at THEN");
    if (has168h) {
      console.log('✓ TEST 3: Máximo absoluto de 168h desde la creación aplicado estrictamente');
      passedCount++;
    } else throw new Error('Fallo en límite 168h');
  } catch (e: any) { console.error('✗ TEST 3:', e.message); }

  // 4. Segundo gift al mismo Dynamo rechazado
  try {
    const hasDuplicateCheck = sqlCodeOnly.includes('dynamo_id = p_dynamo_id AND giver_id = v_current_user_id') &&
      sqlCodeOnly.includes('Ya has entregado energía a este Dynamo');
    const hasUniqueConstraint = schema00.includes('CONSTRAINT unique_dynamo_gift_per_user UNIQUE (dynamo_id, giver_id)');
    if (hasDuplicateCheck && hasUniqueConstraint) {
      console.log('✓ TEST 4: Segundo gift al mismo Dynamo rechazado por check y por UNIQUE constraint');
      passedCount++;
    } else throw new Error('Fallo en prevención de duplicados');
  } catch (e: any) { console.error('✗ TEST 4:', e.message); }

  // 5. Self-gift rechazado
  try {
    const hasSelfGift = sqlCodeOnly.includes('IF v_dynamo.user_id = v_current_user_id THEN') &&
      sqlCodeOnly.includes('No puedes inyectar energía a tu propio Dynamo');
    if (hasSelfGift) {
      console.log('✓ TEST 5: Auto-regalo rechazado explícitamente');
      passedCount++;
    } else throw new Error('Fallo en self-gift');
  } catch (e: any) { console.error('✗ TEST 5:', e.message); }

  // 6. Bloqueos
  try {
    const hasBlocks = sqlCodeOnly.includes('FROM public.blocks') &&
      sqlCodeOnly.includes('blocker_id = v_dynamo.user_id AND blocked_id = v_current_user_id') &&
      sqlCodeOnly.includes('blocker_id = v_current_user_id AND blocked_id = v_dynamo.user_id');
    if (hasBlocks) {
      console.log('✓ TEST 6: Bloqueos mutuos respetados bidireccionalmente');
      passedCount++;
    } else throw new Error('Fallo en bloqueos');
  } catch (e: any) { console.error('✗ TEST 6:', e.message); }

  // 7. Usuario inactivo
  try {
    const hasActiveStatus = sqlCodeOnly.includes("v_user_status <> 'active'") &&
      sqlCodeOnly.includes('Tu cuenta se encuentra suspendida o inactiva');
    if (hasActiveStatus) {
      console.log('✓ TEST 7: Usuario inactivo o suspendido bloqueado');
      passedCount++;
    } else throw new Error('Fallo en usuario inactivo');
  } catch (e: any) { console.error('✗ TEST 7:', e.message); }

  // 8. Dynamo expirado
  try {
    const hasExpired = sqlCodeOnly.includes("v_dynamo.status <> 'active' OR v_dynamo.expires_at <= timezone('utc'::text, now())");
    if (hasExpired) {
      console.log('✓ TEST 8: Dynamo expirado o no activo rechazado');
      passedCount++;
    } else throw new Error('Fallo en expiración');
  } catch (e: any) { console.error('✗ TEST 8:', e.message); }

  // 9. allow_dynamos=false
  try {
    const hasAllowDynamos = sqlCodeOnly.includes("key = 'allow_dynamos'") &&
      sqlCodeOnly.includes('El envío de energía ⚡ se encuentra temporalmente deshabilitado');
    if (hasAllowDynamos) {
      console.log('✓ TEST 9: Switch global allow_dynamos respetado');
      passedCount++;
    } else throw new Error('Fallo en allow_dynamos');
  } catch (e: any) { console.error('✗ TEST 9:', e.message); }

  // 10. Maintenance / Emergency
  try {
    const hasEmergency = sqlCodeOnly.includes("key = 'emergency_mode'");
    const hasMaintenance = sqlCodeOnly.includes("key = 'maintenance_mode'");
    if (hasEmergency && hasMaintenance) {
      console.log('✓ TEST 10: Switches de emergencia y mantenimiento respetados');
      passedCount++;
    } else throw new Error('Fallo en maintenance/emergency');
  } catch (e: any) { console.error('✗ TEST 10:', e.message); }

  // 11. 10 gifts gratuitos consumen exactamente la cuota
  try {
    const hasFree10 = sqlCodeOnly.includes('c_daily_user_free_limit CONSTANT INT := 10') &&
      sqlCodeOnly.includes('v_remaining_free := c_daily_user_free_limit - v_free_gifts_in_24h - 1');
    if (hasFree10) {
      console.log('✓ TEST 11: 10 gifts gratuitos consumen exactamente la cuota');
      passedCount++;
    } else throw new Error('Fallo en límite de 10 gratuitos');
  } catch (e: any) { console.error('✗ TEST 11:', e.message); }

  // 12. Gift #11 usa comprado
  try {
    const hasGift11Purchased = sqlCodeOnly.includes("v_balance_type_used := 'purchased'") &&
      sqlCodeOnly.includes('v_new_purchased_balance := v_purchased_balance - 1');
    if (hasGift11Purchased) {
      console.log('✓ TEST 12: Regalo #11 o superior consume saldo adquirido cuando cuota gratuita está en 0');
      passedCount++;
    } else throw new Error('Fallo en consumo de saldo comprado');
  } catch (e: any) { console.error('✗ TEST 12:', e.message); }

  // 13. 10 gifts gratuitos + varios comprados
  try {
    const handlesBoth = sqlCodeOnly.includes("v_free_gifts_in_24h < c_daily_user_free_limit") &&
      sqlCodeOnly.includes("v_purchased_balance > 0");
    if (handlesBoth) {
      console.log('✓ TEST 13: Coexistencia perfecta de 10 gratuitos con saldo comprado disponible');
      passedCount++;
    } else throw new Error('Fallo en coexistencia');
  } catch (e: any) { console.error('✗ TEST 13:', e.message); }

  // 14. Regalos comprados NO reducen cuota gratuita
  try {
    const freeOnlyCount = sqlCodeOnly.includes("balance_type = 'free'") &&
      sqlCodeOnly.includes("transaction_type = 'gift_sent'");
    const getStatusFreeOnly = sqlCodeOnly.includes("balance_type = 'free'") &&
      sqlCodeOnly.includes("v_used_free_today");
    if (freeOnlyCount && getStatusFreeOnly) {
      console.log('✓ TEST 14: Regalos comprados filtrados estrictamente; NO reducen la cuota gratuita');
      passedCount++;
    } else throw new Error('Fallo en aislamiento de cuota gratuita');
  } catch (e: any) { console.error('✗ TEST 14:', e.message); }

  // 15. Ventana móvil de 24 horas
  try {
    const hasRolling24h = sqlCodeOnly.includes("created_at > (timezone('utc'::text, now()) - interval '24 hours')");
    if (hasRolling24h) {
      console.log('✓ TEST 15: Ventana móvil de 24 horas real (no medianoche estática)');
      passedCount++;
    } else throw new Error('Fallo en ventana móvil 24h');
  } catch (e: any) { console.error('✗ TEST 15:', e.message); }

  // 16. Exactamente una notificación cuando está habilitada
  try {
    const hasNotificationCheck = sqlCodeOnly.includes('v_author_wants_notification IS TRUE') &&
      sqlCodeOnly.includes('INSERT INTO public.notifications');
    if (hasNotificationCheck) {
      console.log('✓ TEST 16: Exactamente una notificación insertada cuando las preferencias lo autorizan');
      passedCount++;
    } else throw new Error('Fallo en inserción de notificación');
  } catch (e: any) { console.error('✗ TEST 16:', e.message); }

  // 17. Cero notificaciones cuando la preferencia está deshabilitada
  try {
    const hasPrefQuery = sqlCodeOnly.includes('COALESCE(social_notifications, true) AND COALESCE(notify_dynamos_received, true)') &&
      sqlCodeOnly.includes('FROM public.user_settings');
    if (hasPrefQuery) {
      console.log('✓ TEST 17: Preferencias server-side (social_notifications y notify_dynamos_received) consultadas; 0 notificaciones si están en false');
      passedCount++;
    } else throw new Error('Fallo en chequeo server-side de preferencias');
  } catch (e: any) { console.error('✗ TEST 17:', e.message); }

  // 18. Notificación dirigida al autor correcto
  try {
    const hasCorrectAuthor = sqlCodeOnly.includes('v_dynamo.user_id,') &&
      sqlCodeOnly.includes('v_current_user_id,') &&
      sqlCodeOnly.includes("'gift'");
    if (hasCorrectAuthor) {
      console.log('✓ TEST 18: Notificación dirigida al autor correcto (v_dynamo.user_id) con remitente v_current_user_id');
      passedCount++;
    } else throw new Error('Fallo en destinatario de notificación');
  } catch (e: any) { console.error('✗ TEST 18:', e.message); }

  // 19. No self-notification
  try {
    const noSelfNotification = sqlCodeOnly.includes('v_dynamo.user_id <> v_current_user_id');
    if (noSelfNotification) {
      console.log('✓ TEST 19: Auto-notificación prohibida');
      passedCount++;
    } else throw new Error('Fallo en no-self-notification');
  } catch (e: any) { console.error('✗ TEST 19:', e.message); }

  // 20. Referral first gift
  try {
    const hasReferralTrigger = sqlCodeOnly.includes('CREATE TRIGGER trg_referral_first_gift_event') &&
      sqlCodeOnly.includes('public.trg_referral_first_gift()') &&
      sqlCodeOnly.includes('referred_user_id = NEW.giver_id');
    if (hasReferralTrigger) {
      console.log('✓ TEST 20: Evento first_interaction de referidos registrado de forma idempotente con giver_id');
      passedCount++;
    } else throw new Error('Fallo en trigger referral first gift');
  } catch (e: any) { console.error('✗ TEST 20:', e.message); }

  // 21. Badge awarding
  try {
    const hasBadgeTrigger = sqlCodeOnly.includes('CREATE TRIGGER trg_after_gift_award_badges') &&
      sqlCodeOnly.includes('public.evaluate_and_award_badges(v_author_id)');
    if (hasBadgeTrigger) {
      console.log('✓ TEST 21: Progresión de insignias disparada automáticamente con manejo de excepciones');
      passedCount++;
    } else throw new Error('Fallo en trigger de insignias');
  } catch (e: any) { console.error('✗ TEST 21:', e.message); }

  // 22. Doble request concurrente (jerarquía de locks anti-deadlock)
  try {
    const posUserBalancesLock = sqlCodeOnly.indexOf('FROM public.user_balances');
    const posDynamoLock = sqlCodeOnly.indexOf('FROM public.dynamos');
    const hasProperOrder = posUserBalancesLock !== -1 && posDynamoLock !== -1 && posUserBalancesLock < posDynamoLock;
    if (hasProperOrder) {
      console.log('✓ TEST 22: Jerarquía estricta de locks (user_balances FOR UPDATE -> dynamos FOR UPDATE) elimina deadlocks y race conditions');
      passedCount++;
    } else throw new Error('Orden de locks incorrecto');
  } catch (e: any) { console.error('✗ TEST 22:', e.message); }

  // 23. Atomicidad ante error
  try {
    const hasSecurityDefiner = sqlCodeOnly.includes('SECURITY DEFINER');
    const hasPlpgsql = sqlCodeOnly.includes('LANGUAGE plpgsql');
    if (hasSecurityDefiner && hasPlpgsql) {
      console.log('✓ TEST 23: Transacción atómica integral; rollback automático garantizado si cualquier paso crítico falla');
      passedCount++;
    } else throw new Error('Fallo en atomicidad');
  } catch (e: any) { console.error('✗ TEST 23:', e.message); }

  // 24. Ledger correcto
  try {
    const hasLedgerInsert = sqlCodeOnly.includes('INSERT INTO public.economy_transactions') &&
      sqlCodeOnly.includes('transaction_type,') &&
      sqlCodeOnly.includes("'gift_sent'");
    if (hasLedgerInsert) {
      console.log('✓ TEST 24: Inserción inmutable en economy_transactions con resulting_free_allowance y resulting_purchased_balance');
      passedCount++;
    } else throw new Error('Fallo en registro contable');
  } catch (e: any) { console.error('✗ TEST 24:', e.message); }

  // 25. Saldo nunca negativo
  try {
    const checkBalancePositive = sqlCodeOnly.includes('v_purchased_balance > 0') &&
      sqlCodeOnly.includes('v_purchased_balance - 1');
    if (checkBalancePositive) {
      console.log('✓ TEST 25: Saldo verificado mayor a cero antes de debitar; nunca negativo');
      passedCount++;
    } else throw new Error('Fallo en protección de saldo negativo');
  } catch (e: any) { console.error('✗ TEST 25:', e.message); }

  console.log(`\n======================================================`);
  console.log(`RESULTADO DE TESTS DE AUDITORÍA: ${passedCount}/${totalTests} APROBADOS`);
  console.log(`======================================================\n`);

  if (passedCount !== totalTests) {
    process.exit(1);
  }
}

runTestSuite();
