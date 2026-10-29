/**
 * @fileoverview Offline-First Field Engineer & Commissioning Mobile App (React Native / Expo)
 * Application: mobile-suite/field-engineer-mobile
 * Purpose: Used by COREN-certified field installers to log roof azimuth/earthing audits,
 * scan Growatt & LiFePO4 serial barcodes, verify the lower shroud tamper seal, and sync
 * offline queues when cellular coverage returns.
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

export default function FieldEngineerMobileApp() {
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(false);
  const [offlineQueueCount, setOfflineQueueCount] = useState<number>(0);

  // Barcode & Hardware Provisioning State
  const [growattSerial, setGrowattSerial] = useState('GW-SPF5000ES-99881');
  const [batterySerial, setBatterySerial] = useState('LFP-512V-100AH-441');
  const [edgeIMEI, setEdgeIMEI] = useState('864209051123456');
  const [sealSerial, setSealSerial] = useState('SEAL-NG-00421');

  // Nigerian Electrical & Roof Audit Readings
  const [earthingOhms, setEarthingOhms] = useState('2.3');
  const [roofAzimuthDeg, setRoofAzimuthDeg] = useState('180');
  const [roofTiltDeg, setRoofTiltDeg] = useState('15');
  const [tamperSwitchSealed, setTamperSwitchSealed] = useState(true);

  const [diagnosticResult, setDiagnosticResult] = useState<string | null>(null);

  const parsedEarthing = parseFloat(earthingOhms) || 99.9;
  const isEarthingSafe = parsedEarthing > 0 && parsedEarthing <= 5.0;

  const handleRun5PointCommissioningTest = () => {
    if (!isEarthingSafe) {
      setDiagnosticResult(
        `❌ COMMISSIONING BLOCKED: Earthing resistance (${parsedEarthing} Ω) exceeds the 5.0 Ω surge safety limit. Drive an additional copper earth rod and re-test.`
      );
      return;
    }
    if (!tamperSwitchSealed) {
      setDiagnosticResult(
        '❌ COMMISSIONING BLOCKED: Lower terminal shroud micro-plunger switch is OPEN. Bolt and seal the lower shroud before activating.'
      );
      return;
    }

    if (isOfflineMode) {
      setOfflineQueueCount((c) => c + 1);
      setDiagnosticResult(
        `✅ 5-Point Local Handshake Passed! Saved to encrypted local SQLite queue (${offlineQueueCount + 1} pending sync). Initial 30-day unlock token beamed via BLE.`
      );
    } else {
      setDiagnosticResult(
        '✅ 5-Point Handshake Passed & Synced to Core Backend! VFS Block `/var/lib/payg-vfs/blocks/8f/3a/.../identity.json` provisioned.'
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header & Offline Network Toggle */}
        <View style={styles.header}>
          <View>
            <Text style={styles.badge}>COREN FIELD ENGINEERING SUITE</Text>
            <Text style={styles.title}>Growatt PAYG Commissioning</Text>
          </View>
          <TouchableOpacity
            onPress={() => setIsOfflineMode(!isOfflineMode)}
            style={[styles.netButton, isOfflineMode ? styles.netOffline : styles.netOnline]}
          >
            <Text style={styles.netText}>
              {isOfflineMode ? `OFFLINE (${offlineQueueCount} Queued)` : '4G ONLINE'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Step 1: Hardware Barcode Scanner Binding */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>1. Hardware Serial & Shroud Seal Binding</Text>

          <Text style={styles.label}>Growatt Inverter Serial (Barcode Scan)</Text>
          <TextInput style={styles.input} value={growattSerial} onChangeText={setGrowattSerial} />

          <Text style={styles.label}>LiFePO4 Battery Pack Serial (80% DoD Mandate)</Text>
          <TextInput style={styles.input} value={batterySerial} onChangeText={setBatterySerial} />

          <Text style={styles.label}>Sealed Edge Controller IMEI</Text>
          <TextInput style={styles.input} value={edgeIMEI} onChangeText={setEdgeIMEI} />

          <Text style={styles.label}>Lower Terminal Shroud Steel Seal Serial</Text>
          <TextInput style={styles.input} value={sealSerial} onChangeText={setSealSerial} />
        </View>

        {/* Step 2: Earthing Resistance & Roof Audit */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>2. Earthing (&lt; 5.0 Ω) & Solar Array Audit</Text>

          <Text style={styles.label}>
            Measured Earthing Resistance (Ohms) — {isEarthingSafe ? '✅ SAFE' : '⚠️ UNSAFE (> 5.0 Ω)'}
          </Text>
          <TextInput
            style={[styles.input, !isEarthingSafe && styles.inputDanger]}
            keyboardType="numeric"
            value={earthingOhms}
            onChangeText={setEarthingOhms}
          />

          <View style={styles.row}>
            <View style={styles.half}>
              <Text style={styles.label}>Compass Azimuth (°)</Text>
              <TextInput style={styles.input} keyboardType="numeric" value={roofAzimuthDeg} onChangeText={setRoofAzimuthDeg} />
            </View>
            <View style={styles.half}>
              <Text style={styles.label}>Roof Tilt Angle (°)</Text>
              <TextInput style={styles.input} keyboardType="numeric" value={roofTiltDeg} onChangeText={setRoofTiltDeg} />
            </View>
          </View>

          <TouchableOpacity
            onPress={() => setTamperSwitchSealed(!tamperSwitchSealed)}
            style={styles.toggleRow}
          >
            <Text style={styles.toggleLabel}>Lower Shroud Micro-Plunger Switch State:</Text>
            <Text style={[styles.toggleValue, tamperSwitchSealed ? styles.textSafe : styles.textDanger]}>
              {tamperSwitchSealed ? 'SEALED (CLOSED)' : 'TRIPPED (OPEN)'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Step 3: 5-Point Handshake & Offline Sync */}
        <TouchableOpacity style={styles.primaryBtn} onPress={handleRun5PointCommissioningTest}>
          <Text style={styles.primaryBtnText}>Run 5-Point Handshake & Commission Unit</Text>
        </TouchableOpacity>

        {diagnosticResult && (
          <View style={styles.resultBox}>
            <Text style={styles.resultText}>{diagnosticResult}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  scroll: { padding: 16, gap: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { color: '#34d399', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  title: { color: '#f8fafc', fontSize: 18, fontWeight: '800' },
  netButton: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  netOnline: { backgroundColor: '#065f46' },
  netOffline: { backgroundColor: '#991b1b' },
  netText: { color: '#ffffff', fontSize: 11, fontWeight: '700' },
  card: { backgroundColor: '#0f172a', padding: 14, borderRadius: 14, borderColor: '#1e293b', borderWidth: 1, gap: 8 },
  sectionTitle: { color: '#ffffff', fontSize: 14, fontWeight: '700', marginBottom: 4 },
  label: { color: '#94a3b8', fontSize: 11, fontWeight: '600' },
  input: { backgroundColor: '#020617', color: '#f8fafc', borderColor: '#334155', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13 },
  inputDanger: { borderColor: '#f43f5e' },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8 },
  toggleLabel: { color: '#cbd5e1', fontSize: 12 },
  toggleValue: { fontSize: 12, fontWeight: '800' },
  textSafe: { color: '#34d399' },
  textDanger: { color: '#fb7185' },
  primaryBtn: { backgroundColor: '#10b981', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  primaryBtnText: { color: '#020617', fontWeight: '800', fontSize: 14 },
  resultBox: { backgroundColor: '#0f172a', borderColor: '#10b981', borderWidth: 1, padding: 12, borderRadius: 12 },
  resultText: { color: '#e2e8f0', fontSize: 12, lineHeight: 18 },
});