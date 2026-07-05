export default function DemoAccounts() {
  return (
    <div style={{ marginTop: '1.5rem', fontSize: '0.7rem', color: 'var(--color-text-muted)', textAlign: 'left' }}>
      <p style={{ textAlign: 'center', marginBottom: '0.5rem' }}>Demo accounts — password for all: <strong>Password123!</strong></p>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
            <th style={{ textAlign: 'left', padding: '0.25rem' }}>Email</th>
            <th style={{ textAlign: 'left', padding: '0.25rem' }}>Role</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>admin@credpriv.hospital</td><td>System Admin</td></tr>
          <tr><td>staff@credpriv.hospital</td><td>Credentialing Staff</td></tr>
          <tr><td>committee@credpriv.hospital</td><td>Committee Chair</td></tr>
          <tr><td>deptchair@credpriv.hospital</td><td>Department Head</td></tr>
          <tr><td>provider@credpriv.hospital</td><td>Doctor (clinical)</td></tr>
          <tr><td>nurse@credpriv.hospital</td><td>Nurse (clinical)</td></tr>
          <tr><td>tech@credpriv.hospital</td><td>OT Technician (clinical)</td></tr>
          <tr><td>allied@credpriv.hospital</td><td>Allied Health (clinical)</td></tr>
          <tr><td>hr@credpriv.hospital</td><td>HR Executive (non-clinical)</td></tr>
          <tr><td>housekeeping@credpriv.hospital</td><td>Housekeeping (non-clinical)</td></tr>
        </tbody>
      </table>
    </div>
  );
}
