"use client";
export default function Filters({ status, setStatus, platforms, setPlatforms, location, setLocation }) {
  function togglePlatform(p){
    platforms.includes(p)
      ? setPlatforms(platforms.filter(x=>x!==p))
      : setPlatforms([...platforms, p]);
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
      <div>
        <label className="block text-sm mb-1">Statut</label>
        <select
          value={status}
          onChange={(e)=>setStatus(e.target.value)}
          className="w-full ring-1 ring-brand-100 focus:ring-2 focus:ring-brand-600 rounded-xl px-3 py-2"
        >
          <option value="en_stock">En stock</option>
          <option value="vendu">Vendu</option>
          <option value="all">Tous</option>
        </select>
      </div>

      <div>
        <label className="block text-sm mb-1">Plateformes</label>
        <div className="flex gap-2">
          <button type="button" onClick={()=>togglePlatform("Vinted")}
            className={`px-3 py-2 rounded-xl ring-1 ${platforms.includes("Vinted")?"bg-brand-600 text-white":"ring-brand-100"}`}>Vinted</button>
          <button type="button" onClick={()=>togglePlatform("Rakuten")}
            className={`px-3 py-2 rounded-xl ring-1 ${platforms.includes("Rakuten")?"bg-brand-600 text-white":"ring-brand-100"}`}>Rakuten</button>
        </div>
      </div>

      <div>
        <label className="block text-sm mb-1">Emplacement</label>
        <input
          value={location}
          onChange={(e)=>setLocation(e.target.value)}
          placeholder="ex: A1"
          className="w-full ring-1 ring-brand-100 focus:ring-2 focus:ring-brand-600 rounded-xl px-3 py-2"
        />
      </div>
    </div>
  );
}
