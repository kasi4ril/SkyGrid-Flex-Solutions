/**
 * @fileoverview Customer Android/iOS Mobile App (Live Telemetry, One-Tap Bank/USSD Pay & BLE Offline Unlock)
 * Application: mobile-suite/customer-mobile
 */

import React, { useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { transmitOfflineTokenOverBLE } from './services/ble_unlock';

export default function CustomerMobileApp() {
  const [offlineToken, setOfflineToken] = useState('0014-00720-84921104592');
  const [bleStatus, setBleStatus] = useState<string | null>(null);
  const [paidDaysLeft, setPaidDaysLeft] = useState<number>(19.5);

  const handleBLEOfflineUnlock = async () => {
    try {
      const res = await transmitOfflineTokenOverBLE(
        'DEV-8F3A-GROWATT-00421',
        'AA:BB:CC:8F:3A:21',
        offlineToken
      );
      setPaidDaysLeft((prev) => Math.round((prev + res.grantedDays) * 10) / 10);
      setBleStatus(`✅ ${res.message}`);
    } catch (err: any) {
      setBleStatus(`❌ BLE Error: ${err.message}`);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View>
            <Text style={styles.badge}>SKYTRON GROWATT MOBILE</Text>
            <Text style={styles.title}>SPF 5000ES + 10.24kWh LiFePO4</Text>
          </View>
          <View style={styles.daysBadge}>
            <Text style={styles.daysText}>{paidDaysLeft}d Left</Text>
          </View>
        </View>

        {/* Live Energy Summary Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Live Energy Flow Triangle</Text>
          <View style={styles.metricsRow}>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>☀️ Solar PV</Text>
              <Text style={styles.metricValGreen}>3,420 W</Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>🔋 LiFePO4</Text>
              <Text style={styles.metricValCyan}>92% SoC</Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>🏠 Home Load</Text>
              <Text style={styles.metricValAmber}>1,150 W</Text>
            </View>
          </View>
        </View>

        {/* Dedicated Virtual Accounts & One-Tap USSD/Bank Deep-Link */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Dedicated Virtual Account (Instant Auto-Unlock)</Text>
          <Text style={styles.subText}>Moniepoint MFB • 8049201844</Text>
          <Text style={styles.subText}>Paystack-Titan • 9938471029</Text>
          <Text style={styles.subText}>OPay Digital • 7083920194</Text>
        </View>

        {/* Bluetooth Low Energy (BLE) Offline Unlock Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Bluetooth (BLE) Offline Inverter Unlock</Text>
          <Text style={styles.subText}>
            No GSM network at home? Beam your 20-digit SMS receipt token directly to the sealed Growatt controller via Bluetooth:
          </Text>
          <TextInput
            style={styles.input}
            value={offlineToken}
            onChangeText={setOfflineToken}
            placeholder="XXXX-XXXX-XXXX-XXXX-XXXX"
          />
          <TouchableOpacity style={styles.bleBtn} onPress={handleBLEOfflineUnlock}>
            <Text style={styles.bleBtnText}>Beam 20-Digit Token via Bluetooth (BLE)</Text>
          </TouchableOpacity>

          {bleStatus && <Text style={styles.statusText}>{bleStatus}</Text>}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  scroll: { padding: 16, gap: 14 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { color: '#34d399', fontSize: 10, fontWeight: '700' },
  title: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
  daysBadge: { backgroundColor: '#065f46', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  daysText: { color: '#6ee7b7', fontWeight: '900', fontSize: 13 },
  card: { backgroundColor: '#0f172a', padding: 14, borderRadius: 14, borderColor: '#1e293b', borderWidth: 1, gap: 8 },
  cardTitle: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  metricsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 4 },
  metricBox: { flex: 1, backgroundColor: '#020617', padding: 10, borderRadius: 10, alignItems: 'center' },
  metricLabel: { color: '#94a3b8', fontSize: 11 },
  metricValGreen: { color: '#34d399', fontSize: 15, fontWeight: '900', marginTop: 2 },
  metricValCyan: { color: '#22d3ee', fontSize: 15, fontWeight: '900', marginTop: 2 },
  metricValAmber: { color: '#fbbf24', fontSize: 15, fontWeight: '900', marginTop: 2 },
  subText: { color: '#cbd5e1', fontSize: 12, lineHeight: 18 },
  input: { backgroundColor: '#020617', color: '#ffffff', borderColor: '#334155', borderWidth: 1, borderRadius: 10, padding: 10, fontFamily: 'monospace' },
  bleBtn: { backgroundColor: '#10b981', paddingVertical: 13, borderRadius: 10, alignItems: 'center', marginTop: 4 },
  bleBtnText: { color: '#020617', fontWeight: '800', fontSize: 13 },
  statusText: { color: '#a7f3d0', fontSize: 12, marginTop: 6, lineHeight: 17 },
});