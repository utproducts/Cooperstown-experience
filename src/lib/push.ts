import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Asks for notification permission and returns this device's Expo push token,
 * or null on web, simulators, or when permission is denied.
 */
export async function getPushToken(): Promise<string | null> {
  if (Platform.OS === 'web' || !Device.isDevice) return null;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Game & schedule alerts',
      // eslint-disable-next-line import/namespace -- enum is re-exported from a types module
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  let granted = current.granted;
  if (!granted && current.canAskAgain) granted = (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) return null;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return null; // run `eas init` to link a project before push works
  return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
}
