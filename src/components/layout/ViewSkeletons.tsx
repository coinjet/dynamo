import React from 'react';

export const DynamoCardSkeleton: React.FC = () => {
  return (
    <div
      aria-hidden="true"
      className="rounded-2xl border border-[#21272E] bg-[#12161A] p-4 sm:p-5 shadow-sm animate-pulse space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-stone-800 shrink-0" />
          <div className="space-y-1.5">
            <div className="h-3 w-28 rounded bg-stone-800" />
            <div className="h-2.5 w-16 rounded bg-stone-800/60" />
          </div>
        </div>
        <div className="h-5 w-14 rounded-full bg-stone-800" />
      </div>

      <div className="space-y-2 py-1">
        <div className="h-3.5 w-full rounded bg-stone-800" />
        <div className="h-3.5 w-4/5 rounded bg-stone-800/80" />
        <div className="h-3.5 w-2/5 rounded bg-stone-800/60" />
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-[#1C2229]">
        <div className="h-7 w-20 rounded-lg bg-stone-800" />
        <div className="h-7 w-16 rounded-lg bg-stone-800" />
        <div className="h-7 w-16 rounded-lg bg-stone-800" />
      </div>
    </div>
  );
};

export const FeedSkeleton: React.FC = () => {
  return (
    <div aria-busy="true" aria-label="Cargando publicaciones" className="space-y-4">
      <DynamoCardSkeleton />
      <DynamoCardSkeleton />
      <DynamoCardSkeleton />
    </div>
  );
};

export const ProfileSkeleton: React.FC = () => {
  return (
    <div aria-busy="true" aria-label="Cargando perfil" className="space-y-6 animate-pulse">
      <div className="rounded-2xl border border-[#21272E] bg-[#12161A] p-6 space-y-4">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
          <div className="h-20 w-20 rounded-full bg-stone-800 shrink-0" />
          <div className="space-y-2 text-center sm:text-left flex-1">
            <div className="h-5 w-36 mx-auto sm:mx-0 rounded bg-stone-800" />
            <div className="h-3 w-24 mx-auto sm:mx-0 rounded bg-stone-800/60" />
            <div className="h-3 w-48 mx-auto sm:mx-0 rounded bg-stone-800/40 pt-1" />
          </div>
          <div className="h-9 w-28 rounded-xl bg-stone-800" />
        </div>
        <div className="grid grid-cols-3 gap-2 pt-4 border-t border-[#1C2229]">
          <div className="h-12 rounded-xl bg-stone-800/50" />
          <div className="h-12 rounded-xl bg-stone-800/50" />
          <div className="h-12 rounded-xl bg-stone-800/50" />
        </div>
      </div>
      <FeedSkeleton />
    </div>
  );
};

export const DiscoverySkeleton: React.FC = () => {
  return (
    <div aria-busy="true" aria-label="Cargando descubrimiento" className="space-y-6 animate-pulse">
      <div className="h-11 w-full rounded-xl bg-stone-800" />
      <div className="flex gap-2">
        <div className="h-8 w-24 rounded-lg bg-stone-800" />
        <div className="h-8 w-24 rounded-lg bg-stone-800" />
        <div className="h-8 w-24 rounded-lg bg-stone-800" />
      </div>
      <div className="rounded-2xl border border-[#21272E] bg-[#12161A] p-5 space-y-3">
        <div className="h-4 w-32 rounded bg-stone-800" />
        <div className="h-8 w-full rounded bg-stone-800/50" />
        <div className="h-8 w-full rounded bg-stone-800/50" />
        <div className="h-8 w-full rounded bg-stone-800/50" />
      </div>
    </div>
  );
};

export const SettingsSkeleton: React.FC = () => {
  return (
    <div aria-busy="true" aria-label="Cargando configuración" className="space-y-6 animate-pulse">
      <div className="h-8 w-48 rounded bg-stone-800" />
      <div className="space-y-4">
        <div className="h-32 rounded-2xl border border-[#21272E] bg-[#12161A] p-5" />
        <div className="h-40 rounded-2xl border border-[#21272E] bg-[#12161A] p-5" />
        <div className="h-36 rounded-2xl border border-[#21272E] bg-[#12161A] p-5" />
      </div>
    </div>
  );
};

export const BestDynamosSkeleton: React.FC = () => {
  return (
    <div aria-busy="true" aria-label="Cargando mejores publicaciones" className="space-y-6 animate-pulse">
      <div className="h-8 w-40 rounded bg-stone-800" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="h-28 rounded-2xl bg-stone-800/50" />
        <div className="h-32 rounded-2xl bg-stone-800/70" />
        <div className="h-28 rounded-2xl bg-stone-800/50" />
      </div>
      <FeedSkeleton />
    </div>
  );
};
