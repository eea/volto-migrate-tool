import DashboardFixer from './DashboardParser';
import MapChartStaticParser from './MapChartStaticParser';

export default function Parser() {
  return (
    <div>
      <MapChartStaticParser />
      <br />
      <DashboardFixer />
    </div>
  );
}
