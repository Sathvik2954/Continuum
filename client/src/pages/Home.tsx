import { Link } from 'react-router-dom';
import { IconArrowRight, IconShieldCheck, IconDatabaseOff, IconVideo, IconTimeline } from '@tabler/icons-react';
import Logo from '../components/Logo';

export const Home = () => {
  const storedUser = localStorage.getItem('user');
  const token = localStorage.getItem('token');
  const user = storedUser ? JSON.parse(storedUser) : null;

  return (
    <div className="min-h-[80vh] flex flex-col justify-center py-6">
      {/* Hero Section */}
      <div className="text-center max-w-3xl mx-auto space-y-6 py-12">
        <div className="flex justify-center mb-2">
          {/* Logo SVG stroke color and width */}
          <Logo color="#6B87E0" width={90} />
        </div>
        
        <h1 className="text-[22px] md:text-[28px] font-medium text-mist-900 leading-tight">
          Own your health. Continue your care. Anywhere.
        </h1>
        
        <p className="text-[14px] text-mist-600 leading-relaxed max-w-xl mx-auto">
          Continuum keeps your clinical history, vitals logs, and consultations in a secure, offline-first personal vault. Access your care timeline anytime—even without active internet.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
          {token && user ? (
            <Link
              to={
                user.role === 'PATIENT'
                  ? '/patient/dashboard'
                  : user.role === 'DOCTOR'
                  ? '/doctor/dashboard'
                  : '/admin/dashboard'
              }
              className="px-5 py-2.5 bg-mist-400 hover:bg-mist-600 text-white text-[13px] font-medium rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>Go to Dashboard</span>
              <IconArrowRight size={14} stroke={1.5} />
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="px-5 py-2.5 bg-mist-400 hover:bg-mist-600 text-white text-[13px] font-medium rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span>Access Your Care</span>
                <IconArrowRight size={14} stroke={1.5} />
              </Link>
              <Link
                to="/register"
                className="px-5 py-2.5 bg-transparent border-1.5 border-mist-200 text-mist-600 text-[13px] font-medium rounded-lg hover:bg-mist-50 transition-all cursor-pointer"
              >
                <span>Join the Network</span>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Feature Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
        {/* Feature 1 */}
        <div className="bg-white p-5 rounded-xl border border-mist-100 flex flex-col space-y-3">
          <div className="p-2.5 bg-mist-50 border border-mist-100 rounded-lg text-mist-600 w-fit">
            <IconDatabaseOff size={20} stroke={1.5} />
          </div>
          <div>
            <h3 className="text-subheading">Offline-First Vault</h3>
            <p className="text-[12px] text-mist-600 mt-1 leading-normal">
              Your clinical history is cached locally. Review profiles, prescriptions, and timeline events offline.
            </p>
          </div>
        </div>

        {/* Feature 2 */}
        <div className="bg-white p-5 rounded-xl border border-mist-100 flex flex-col space-y-3">
          <div className="p-2.5 bg-mist-50 border border-mist-100 rounded-lg text-mist-600 w-fit">
            <IconShieldCheck size={20} stroke={1.5} />
          </div>
          <div>
            <h3 className="text-subheading">Access Ownership</h3>
            <p className="text-[12px] text-mist-600 mt-1 leading-normal">
              Grant or revoke access permissions to your records in real-time. You own your clinical history.
            </p>
          </div>
        </div>

        {/* Feature 3 */}
        <div className="bg-white p-5 rounded-xl border border-mist-100 flex flex-col space-y-3">
          <div className="p-2.5 bg-mist-50 border border-mist-100 rounded-lg text-mist-600 w-fit">
            <IconVideo size={20} stroke={1.5} />
          </div>
          <div>
            <h3 className="text-subheading">P2P Teleconsultations</h3>
            <p className="text-[12px] text-mist-600 mt-1 leading-normal">
              Secure WebRTC video and audio rooms. Records mixed audio tracks locally and queues uploads dynamically.
            </p>
          </div>
        </div>

        {/* Feature 4 */}
        <div className="bg-white p-5 rounded-xl border border-mist-100 flex flex-col space-y-3">
          <div className="p-2.5 bg-mist-50 border border-mist-100 rounded-lg text-mist-600 w-fit">
            <IconTimeline size={20} stroke={1.5} />
          </div>
          <div>
            <h3 className="text-subheading">Immutable Change Log</h3>
            <p className="text-[12px] text-mist-600 mt-1 leading-normal">
              Field-level tracing records revisions to profile demographics and prescriptions for compliance audits.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
