import { Lightbulb, Power, Zap } from 'lucide-react';
import { getRuleDescription, RULE_OPTIONS } from '../../automation/rules';
import { formatDeviceName } from '../../utils/format';
import SelectField from '../common/SelectField';
import ToggleSwitch from '../common/ToggleSwitch';
import styles from './DeviceAutomationCard.module.css';

const deviceIconMap = {
  LED1: Zap,
  LED2: Lightbulb,
  LED3: Power,
};

function DeviceAutomationCard({
  devices,
  selectedRules,
  loadingById,
  onToggle,
  onRuleChange,
}) {
  return (
    <section className={styles.card}>
      <div className={styles.topRow}>
        <div>
          <h2 className={styles.heading}>Device Control</h2>
          <p className={styles.subheading}>Manage your smart devices with real backend actions</p>
        </div>
        <div>
          <h2 className={styles.heading}>Automation</h2>
          <p className={styles.subheading}>Pick a rule per device and let polling keep it in sync</p>
        </div>
      </div>

      <div className={styles.rows}>
        {devices.map((device) => {
          const Icon = deviceIconMap[device.device_code] || Lightbulb;
          const selectedRule = selectedRules[device.device_code] || 'none';
          const isLoading = Boolean(loadingById[device.device_id]);

          return (
            <div key={device.device_id} className={styles.row}>
              <div className={styles.deviceInfo}>
                <span className={styles.deviceIcon}>
                  <Icon size={18} strokeWidth={2} />
                </span>
                <div>
                  <div className={styles.deviceName}>{formatDeviceName(device)}</div>
                  <div className={styles.deviceState}>
                    Current state: {device.state === 1 ? 'On' : 'Off'}
                  </div>
                </div>
              </div>

              <div className={styles.toggleCell}>
                <ToggleSwitch
                  checked={device.state === 1}
                  disabled={isLoading}
                  label={`Toggle ${formatDeviceName(device)}`}
                  onChange={() => onToggle(device)}
                />
                <span className={styles.toggleLabel}>
                  {isLoading ? 'Updating...' : device.state === 1 ? 'On' : 'Off'}
                </span>
              </div>

              <div className={styles.ruleCell}>
                <SelectField
                  ariaLabel={`Automation rule for ${formatDeviceName(device)}`}
                  value={selectedRule}
                  options={RULE_OPTIONS}
                  onChange={(value) => onRuleChange(device.device_code, value)}
                />
                <p className={styles.ruleHint}>{getRuleDescription(selectedRule)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default DeviceAutomationCard;
