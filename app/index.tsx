// app/index.tsx - Complete and Fixed Version

import { Camera, CameraView } from "expo-camera";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  Linking,
  Modal,
  NativeModules,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import type { Socket } from "react-native-tcp-socket";
import TcpSocket from "react-native-tcp-socket";

const { TouchInjection } = NativeModules;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface CursorPosition {
  x: number;
  y: number;
}

interface ServerMessage {
  type: string;
  status?: string;
  x?: number;
  y?: number;
  action?: string;
  button?: string;
  dx?: number;
  dy?: number;
  key?: string;
}

interface QRData {
  ip: string;
  port: string;
  code: string;
  app: string;
}

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

const Index = (): JSX.Element => {
  const [pairingCode, setPairingCode] = useState<string>("");
  const [serverIp, setServerIp] = useState<string>("");
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("disconnected");
  const [statusLog, setStatusLog] = useState<string[]>([]);
  const [cursorPosition, setCursorPosition] = useState<CursorPosition>({
    x: 0,
    y: 0,
  });
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [showQRScanner, setShowQRScanner] = useState<boolean>(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [accessibilityEnabled, setAccessibilityEnabled] =
    useState<boolean>(false);

  const socketRef = useRef<Socket | null>(null);
  const lastTouchRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === "granted");
    })();

    checkAccessibilityService();

    if (!TcpSocket || typeof TcpSocket.createConnection !== "function") {
      addLog("⚠️ WARNING: TCP Socket library not properly loaded!");
    } else {
      addLog("✓ TCP Socket library loaded successfully");
    }
  }, []);

  const checkAccessibilityService = async (): Promise<void> => {
    if (!TouchInjection) {
      addLog("⚠️ Touch injection module not available");
      return;
    }

    try {
      const enabled = await TouchInjection.checkAccessibilityEnabled();
      setAccessibilityEnabled(enabled);

      if (enabled) {
        addLog("✓ Accessibility service enabled");
      } else {
        addLog(
          "⚠️ Accessibility service disabled - touch injection won't work"
        );
      }
    } catch (error) {
      addLog(`Accessibility check failed: ${(error as Error).message}`);
    }
  };

  const requestAccessibilityPermission = (): void => {
    Alert.alert(
      "Accessibility Service Required",
      "To control your Android device with mouse, you need to enable MouseShare in Accessibility Settings.\n\n" +
        "Steps:\n" +
        "1. Go to Settings → Accessibility\n" +
        "2. Find 'MouseShare Touch Control'\n" +
        "3. Enable the service",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Open Settings",
          onPress: () => Linking.openSettings(),
        },
      ]
    );
  };

  const addLog = (message: string): void => {
    const timestamp = new Date().toLocaleTimeString();
    setStatusLog((prev) => [`${timestamp}: ${message}`, ...prev].slice(0, 20));
  };

  const handleQRScan = (data: string): void => {
    try {
      const qrData: QRData = JSON.parse(data);

      if (
        qrData.app === "MouseShare" &&
        qrData.ip &&
        qrData.port &&
        qrData.code
      ) {
        const ipWithPort = `${qrData.ip}:${qrData.port}`;
        setServerIp(ipWithPort);
        setPairingCode(qrData.code);
        setShowQRScanner(false);
        addLog(`QR Code scanned - IP: ${ipWithPort}, Code: ${qrData.code}`);
        Alert.alert(
          "QR Code Scanned",
          `Connection details loaded!\nIP: ${ipWithPort}\nCode: ${qrData.code}`,
          [{ text: "OK" }]
        );
      } else {
        Alert.alert("Invalid QR Code", "This QR code is not for MouseShare");
      }
    } catch (error) {
      addLog(`QR scan error: ${(error as Error).message}`);
      Alert.alert("Error", "Invalid QR code format");
    }
  };

  const openQRScanner = (): void => {
    if (hasPermission === null) {
      Alert.alert("Permission", "Requesting camera permission...");
      return;
    }
    if (hasPermission === false) {
      Alert.alert(
        "No Camera Permission",
        "Please grant camera permission to scan QR codes"
      );
      return;
    }
    setShowQRScanner(true);
  };

  const connectToServer = (): void => {
    if (!serverIp || !pairingCode) {
      Alert.alert("Error", "Please enter both IP address and pairing code");
      return;
    }

    // Check accessibility first
    if (!accessibilityEnabled) {
      Alert.alert(
        "Accessibility Service Required",
        "Touch control won't work without accessibility service. Enable it now?",
        [
          { text: "Continue Anyway", onPress: () => performConnection() },
          {
            text: "Enable",
            onPress: () => requestAccessibilityPermission(),
          },
        ]
      );
      return;
    }

    performConnection();
  };

  const performConnection = (): void => {
    let host = serverIp;
    let port = 5555;

    if (serverIp.includes(":")) {
      const parts = serverIp.split(":");
      host = parts[0];
      port = parseInt(parts[1], 10) || 5555;
    }

    setConnectionStatus("connecting");
    addLog(`Connecting to ${host}:${port}...`);

    try {
      if (!TcpSocket || typeof TcpSocket.createConnection !== "function") {
        throw new Error("TCP Socket library not available");
      }

      const client = TcpSocket.createConnection(
        {
          port: port,
          host: host,
          timeout: 5000,
        },
        () => {
          addLog("TCP connection established");

          const pairingMessage = JSON.stringify({
            type: "pairing",
            code: pairingCode,
          });

          if (client && client.write) {
            client.write(pairingMessage);
            addLog("Pairing code sent");
          }
        }
      );

      if (!client) {
        throw new Error("Failed to create socket connection");
      }

      client.on("data", (data: Uint8Array | string) => {
        try {
          const message: ServerMessage = JSON.parse(data.toString());
          handleServerMessage(message);
        } catch (error) {
          addLog(`Parse error: ${(error as Error).message}`);
        }
      });

      client.on("error", (error: string) => {
        setConnectionStatus("error");
        addLog(`Connection error: ${error}`);
        Alert.alert("Connection Error", `Failed to connect: ${error}`);

        if (socketRef.current) {
          try {
            socketRef.current.destroy();
          } catch (e) {
            // Ignore cleanup errors
          }
          socketRef.current = null;
        }
      });

      client.on("close", () => {
        setIsConnected(false);
        setConnectionStatus("disconnected");
        addLog("Connection closed");
        socketRef.current = null;
      });

      socketRef.current = client;
    } catch (error) {
      setConnectionStatus("error");
      const errorMessage = (error as Error).message;
      addLog(`Error: ${errorMessage}`);
      Alert.alert("Connection Error", errorMessage);
    }
  };

  const handleServerMessage = (message: ServerMessage): void => {
    switch (message.type) {
      case "pairing_response":
        if (message.status === "success") {
          setIsConnected(true);
          setConnectionStatus("connected");
          addLog("✓ Successfully paired with desktop!");
          sendScreenInfo();
        } else {
          setConnectionStatus("error");
          addLog("✗ Pairing failed - invalid code");
          Alert.alert("Pairing Failed", "Invalid pairing code");
          disconnect();
        }
        break;

      case "mouse":
        handleMouseEvent(message);
        break;

      case "click":
        handleClickEvent(message);
        break;

      case "scroll":
        handleScrollEvent(message);
        break;

      case "keyboard":
        handleKeyboardEvent(message);
        break;

      case "pong":
        break;

      default:
        addLog(`Unknown message type: ${message.type}`);
    }
  };

  const sendScreenInfo = (): void => {
    if (socketRef.current && isConnected) {
      const screenInfo = JSON.stringify({
        type: "screen_info",
        width: Math.floor(SCREEN_WIDTH),
        height: Math.floor(SCREEN_HEIGHT),
      });

      socketRef.current.write(screenInfo);
      addLog(
        `Screen info sent: ${Math.floor(SCREEN_WIDTH)}x${Math.floor(
          SCREEN_HEIGHT
        )}`
      );
    }
  };

  const handleMouseEvent = async (message: ServerMessage): Promise<void> => {
    const { x = 0, y = 0 } = message;
    setCursorPosition({ x, y });
    lastTouchRef.current = { x, y };

    // Inject touch movement
    if (TouchInjection && accessibilityEnabled) {
      try {
        await TouchInjection.injectTouch(x, y, "down");
      } catch (error) {
        // Don't spam logs with touch errors
      }
    }
  };

  const handleClickEvent = async (message: ServerMessage): Promise<void> => {
    const { x = 0, y = 0, action = "" } = message;
    addLog(`Click at (${x}, ${y}) - ${action}`);

    // Inject click
    if (TouchInjection && accessibilityEnabled) {
      try {
        if (action === "down") {
          await TouchInjection.injectClick(x, y);
          addLog(`✓ Touch injected at (${x}, ${y})`);
        }
      } catch (error) {
        addLog(`Touch injection failed: ${(error as Error).message}`);
      }
    }
  };

  const handleScrollEvent = async (message: ServerMessage): Promise<void> => {
    const { dx = 0, dy = 0 } = message;
    addLog(`Scroll: dx=${dx}, dy=${dy}`);

    // Inject scroll gesture
    if (TouchInjection && accessibilityEnabled) {
      try {
        const startX = lastTouchRef.current.x || SCREEN_WIDTH / 2;
        const startY = lastTouchRef.current.y || SCREEN_HEIGHT / 2;
        const endX = startX + dx * 10;
        const endY = startY - dy * 50; // Negative because scroll is inverted

        await TouchInjection.injectScroll(startX, startY, endX, endY);
        addLog(`✓ Scroll gesture injected`);
      } catch (error) {
        addLog(`Scroll injection failed: ${(error as Error).message}`);
      }
    }
  };

  const handleKeyboardEvent = (message: ServerMessage): void => {
    const { key = "", action = "" } = message;
    addLog(`Key ${action}: ${key}`);
    // Keyboard input would require additional native implementation
  };

  const disconnect = (): void => {
    if (socketRef.current) {
      socketRef.current.destroy();
      socketRef.current = null;
    }
    setIsConnected(false);
    setConnectionStatus("disconnected");
    addLog("Disconnected from desktop");
  };

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.destroy();
      }
    };
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* QR Scanner Modal */}
      <Modal
        visible={showQRScanner}
        animationType="slide"
        onRequestClose={() => setShowQRScanner(false)}
      >
        <View style={styles.scannerContainer}>
          <View style={styles.scannerHeader}>
            <Text style={styles.scannerTitle}>Scan QR Code</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowQRScanner(false)}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.cameraWrapper}>
            <CameraView
              style={styles.camera}
              facing="back"
              onBarcodeScanned={({ data }) => {
                handleQRScan(data);
              }}
            />
            <View style={styles.scannerOverlay}>
              <View style={styles.scannerFrame} />
              <Text style={styles.scannerInstructions}>
                Point camera at MouseShare QR code
              </Text>
            </View>
          </View>
        </View>
      </Modal>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🖱️ Mouse Share</Text>
        <Text style={styles.subtitle}>Control Android from Desktop</Text>
        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: isConnected ? "#10b981" : "#6b7280",
              },
            ]}
          >
            <Text style={styles.statusText}>
              {isConnected ? "● Connected" : "○ Disconnected"}
            </Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: accessibilityEnabled ? "#10b981" : "#ef4444",
              },
            ]}
          >
            <Text style={styles.statusText}>
              {accessibilityEnabled ? "● Touch Enabled" : "○ Touch Disabled"}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Accessibility Warning */}
        {!accessibilityEnabled && (
          <View style={styles.warningCard}>
            <Text style={styles.warningTitle}>⚠️ Setup Required</Text>
            <Text style={styles.warningText}>
              Accessibility service is required for touch control to work.
            </Text>
            <TouchableOpacity
              style={styles.warningButton}
              onPress={requestAccessibilityPermission}
            >
              <Text style={styles.warningButtonText}>Enable Accessibility</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Connection Form */}
        {!isConnected && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Connect to Desktop</Text>

            <TouchableOpacity style={styles.qrButton} onPress={openQRScanner}>
              <Text style={styles.qrButtonText}>📷 Scan QR Code</Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR ENTER MANUALLY</Text>
              <View style={styles.dividerLine} />
            </View>

            <Text style={styles.label}>Desktop IP Address:Port</Text>
            <TextInput
              style={styles.input}
              value={serverIp}
              onChangeText={setServerIp}
              placeholder="192.168.1.100:5555"
              placeholderTextColor="#9ca3af"
              keyboardType="default"
              autoCapitalize="none"
            />

            <Text style={styles.label}>Pairing Code (6 digits)</Text>
            <TextInput
              style={[styles.input, styles.codeInput]}
              value={pairingCode}
              onChangeText={setPairingCode}
              placeholder="123456"
              placeholderTextColor="#9ca3af"
              keyboardType="number-pad"
              maxLength={6}
            />

            <TouchableOpacity
              style={[
                styles.button,
                connectionStatus === "connecting" && styles.buttonDisabled,
              ]}
              onPress={connectToServer}
              disabled={connectionStatus === "connecting"}
            >
              <Text style={styles.buttonText}>
                {connectionStatus === "connecting"
                  ? "Connecting..."
                  : "Connect"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Connected Status */}
        {isConnected && (
          <View style={styles.card}>
            <View style={styles.connectedHeader}>
              <Text style={styles.connectedTitle}>✓ Connected</Text>
              <TouchableOpacity
                style={styles.disconnectButton}
                onPress={disconnect}
              >
                <Text style={styles.disconnectButtonText}>Disconnect</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.infoText}>Server: {serverIp}</Text>
              <Text style={styles.infoText}>
                Screen: {Math.floor(SCREEN_WIDTH)}x{Math.floor(SCREEN_HEIGHT)}
              </Text>
              <Text style={styles.infoText}>
                Cursor: ({cursorPosition.x}, {cursorPosition.y})
              </Text>
            </View>
          </View>
        )}

        {/* Visual Feedback */}
        {isConnected && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Touch Simulation</Text>
            <View style={styles.screenPreview}>
              <View
                style={[
                  styles.cursor,
                  {
                    left: `${(cursorPosition.x / SCREEN_WIDTH) * 100}%`,
                    top: `${(cursorPosition.y / SCREEN_HEIGHT) * 100}%`,
                  },
                ]}
              />
              <Text style={styles.previewText}>
                {accessibilityEnabled
                  ? "Touch Active - Controlling Device"
                  : "Preview Only - Enable Accessibility"}
              </Text>
            </View>
          </View>
        )}

        {/* Activity Log */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Activity Log</Text>
          <View style={styles.logContainer}>
            {statusLog.length === 0 ? (
              <Text style={styles.logEmpty}>No activity yet...</Text>
            ) : (
              statusLog.map((log, idx) => (
                <Text key={idx} style={styles.logText}>
                  {log}
                </Text>
              ))
            )}
          </View>
        </View>

        {/* Instructions */}
        <View style={styles.instructionsCard}>
          <Text style={styles.instructionsTitle}>📱 How to Use:</Text>
          <Text style={styles.instructionsText}>
            1. Enable Accessibility Service (if needed){"\n"}
            2. Start Python server on desktop{"\n"}
            3. Scan QR code or enter IP and code{"\n"}
            4. Tap Connect button{"\n"}
            5. Enable control checkbox on desktop{"\n"}
            6. Move mouse right edge to control Android
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1e293b",
  },
  header: {
    backgroundColor: "#0f172a",
    padding: 20,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#94a3b8",
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  warningCard: {
    backgroundColor: "#dc2626",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  warningTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    color: "#fee2e2",
    marginBottom: 16,
    lineHeight: 20,
  },
  warningButton: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  warningButtonText: {
    color: "#dc2626",
    fontSize: 14,
    fontWeight: "600",
  },
  card: {
    backgroundColor: "#334155",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 16,
  },
  qrButton: {
    backgroundColor: "#3b82f6",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginBottom: 16,
  },
  qrButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#475569",
  },
  dividerText: {
    color: "#64748b",
    fontSize: 12,
    marginHorizontal: 12,
    fontWeight: "600",
  },
  label: {
    fontSize: 14,
    color: "#cbd5e1",
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: "#1e293b",
    borderRadius: 8,
    padding: 12,
    color: "#fff",
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#475569",
  },
  codeInput: {
    fontSize: 24,
    fontFamily: "monospace",
    textAlign: "center",
    letterSpacing: 4,
  },
  button: {
    backgroundColor: "#8b5cf6",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginTop: 20,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  connectedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  connectedTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#10b981",
  },
  disconnectButton: {
    backgroundColor: "#dc2626",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  disconnectButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  infoBox: {
    backgroundColor: "#1e293b",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#8b5cf6",
  },
  infoText: {
    color: "#cbd5e1",
    fontSize: 14,
    marginBottom: 4,
  },
  screenPreview: {
    backgroundColor: "#1e293b",
    borderRadius: 8,
    height: 300,
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#8b5cf6",
    overflow: "hidden",
  },
  cursor: {
    position: "absolute",
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#8b5cf6",
    opacity: 0.7,
    transform: [{ translateX: -16 }, { translateY: -16 }],
  },
  previewText: {
    color: "#64748b",
    fontSize: 12,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  logContainer: {
    backgroundColor: "#1e293b",
    borderRadius: 8,
    padding: 12,
    height: 150,
  },
  logEmpty: {
    color: "#64748b",
    fontSize: 14,
  },
  logText: {
    color: "#cbd5e1",
    fontSize: 11,
    fontFamily: "monospace",
    marginBottom: 4,
  },
  instructionsCard: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#334155",
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 8,
  },
  instructionsText: {
    color: "#94a3b8",
    fontSize: 13,
    lineHeight: 20,
  },
  scannerContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  scannerHeader: {
    backgroundColor: "#0f172a",
    padding: 20,
    paddingTop: 50,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  scannerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#334155",
    justifyContent: "center",
    alignItems: "center",
  },
  closeButtonText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "300",
  },
  cameraWrapper: {
    flex: 1,
    position: "relative",
  },
  camera: {
    flex: 1,
  },
  scannerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  scannerFrame: {
    width: 250,
    height: 250,
    borderWidth: 3,
    borderColor: "#8b5cf6",
    borderRadius: 20,
    backgroundColor: "transparent",
  },
  scannerInstructions: {
    color: "#fff",
    fontSize: 16,
    marginTop: 30,
    textAlign: "center",
    paddingHorizontal: 40,
  },
});

export default Index;
