import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import './Status.css';

interface ApiStatus {
  status: string;
  version: string;
  timestamp: string;
  uptime: number;
}

interface ServiceStatus {
  name: string;
  endpoint: string;
  status: 'online' | 'offline' | 'loading';
  data?: ApiStatus;
  error?: string;
  lastChecked?: string;
}

export default function Status() {
  const [services, setServices] = useState<ServiceStatus[]>([
    {
      name: 'API Server',
      endpoint: 'http://localhost:3000/api/v1/status',
      status: 'loading',
    },
  ]);

  const checkAllServicesRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    const checkStatus = async (service: ServiceStatus): Promise<ServiceStatus> => {
      try {
        const response = await fetch(service.endpoint);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        return {
          ...service,
          status: 'online',
          data,
          lastChecked: new Date().toISOString(),
        };
      } catch (error) {
        return {
          ...service,
          status: 'offline',
          error: error instanceof Error ? error.message : 'Unknown error',
          lastChecked: new Date().toISOString(),
        };
      }
    };

    const checkAllServices = async () => {
      setServices(currentServices => {
        Promise.all(currentServices.map(checkStatus)).then(setServices);
        return currentServices;
      });
    };

    checkAllServicesRef.current = checkAllServices;

    checkAllServices();
    const interval = setInterval(checkAllServices, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    checkAllServicesRef.current?.();
  };

  const getStatusColor = (status: ServiceStatus['status']) => {
    switch (status) {
      case 'online':
        return '#4ade80';
      case 'offline':
        return '#f87171';
      default:
        return '#fbbf24';
    }
  };

  return (
    <div className="status-page">
      <div className="status-header">
        <h1>System Status</h1>
        <Link to="/" className="back-link">
          ← Back to Home
        </Link>
      </div>

      <div className="services-grid">
        {services.map((service) => (
          <div key={service.name} className="service-card">
            <div className="service-header">
              <h2>{service.name}</h2>
              <div
                className="status-indicator"
                style={{ backgroundColor: getStatusColor(service.status) }}
                title={service.status}
              />
            </div>

            <div className="service-details">
              <div className="detail-row">
                <span className="label">Status:</span>
                <span className={`value status-${service.status}`}>
                  {service.status.toUpperCase()}
                </span>
              </div>

              {service.data && (
                <>
                  <div className="detail-row">
                    <span className="label">Version:</span>
                    <span className="value">{service.data.version}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Uptime:</span>
                    <span className="value">{Math.floor(service.data.uptime)}s</span>
                  </div>
                </>
              )}

              {service.error && (
                <div className="detail-row error">
                  <span className="label">Error:</span>
                  <span className="value">{service.error}</span>
                </div>
              )}

              {service.lastChecked && (
                <div className="detail-row">
                  <span className="label">Last Checked:</span>
                  <span className="value">
                    {new Date(service.lastChecked).toLocaleTimeString()}
                  </span>
                </div>
              )}

              <div className="detail-row">
                <span className="label">Endpoint:</span>
                <span className="value endpoint">{service.endpoint}</span>
              </div>
            </div>

            <button type="button" onClick={handleRefresh} className="refresh-button">
              Refresh Status
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
