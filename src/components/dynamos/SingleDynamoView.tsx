import React, { useState, useEffect } from 'react';
import { Dynamo } from '@/src/modules/dynamos/dynamosTypes';
import { dynamosService } from '@/src/modules/dynamos/dynamosService';
import { DynamoCard } from './DynamoCard';
import { useAuth } from '@/src/modules/auth/AuthContext';
import { ArrowLeft, Clock, AlertCircle, Loader2 } from 'lucide-react';

interface SingleDynamoViewProps {
  dynamoId: string;
  onBack: () => void;
  onGiftEnergy: (dynamoId: string) => Promise<any>;
  onOpenReply: (dynamo: Dynamo) => void;
  onReport?: (dynamoId: string, authorId?: string) => void;
  onDelete?: (dynamoId: string) => void;
  onSelectHashtag?: (tag: string) => void;
  onAuthorClick?: (author: any) => void;
  onOpenAuth: () => void;
}

export const SingleDynamoView: React.FC<SingleDynamoViewProps> = ({
  dynamoId,
  onBack,
  onGiftEnergy,
  onOpenReply,
  onReport,
  onDelete,
  onSelectHashtag,
  onAuthorClick,
  onOpenAuth,
}) => {
  const { user } = useAuth();
  const [dynamo, setDynamo] = useState<Dynamo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpired, setIsExpired] = useState(false);
  const [isModerated, setIsModerated] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setNotFound(false);
    setIsExpired(false);
    setIsModerated(false);

    dynamosService
      .getDynamoById(dynamoId)
      .then((data) => {
        if (!isMounted) return;
        if (!data) {
          setNotFound(true);
          return;
        }

        if (data.status === 'hidden') {
          setIsModerated(true);
          return;
        }

        const isTimeExpired = new Date(data.expires_at).getTime() <= Date.now() || data.status === 'expired';
        if (isTimeExpired) {
          setIsExpired(true);
          return;
        }

        setDynamo(data);
      })
      .catch((err) => {
        console.error('Error loading single dynamo:', err);
        if (isMounted) setNotFound(true);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [dynamoId]);

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-6">
      {/* Navigation Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          id="btn-single-dynamo-back"
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-stone-800 bg-[#12161A] text-stone-300 hover:text-white hover:border-stone-700 text-xs font-semibold transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-amber-400" />
          <span>Volver al feed</span>
        </button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-24 text-stone-400 gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
          <p className="text-xs">Cargando Dynamo...</p>
        </div>
      )}

      {/* 404 Not Found state */}
      {!isLoading && notFound && (
        <div className="rounded-2xl border border-stone-800 bg-[#12161A] p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-stone-800/80 border border-stone-700 flex items-center justify-center mx-auto mb-4 text-stone-400">
            <AlertCircle className="w-6 h-6 text-amber-500" />
          </div>
          <h2 className="text-lg font-bold text-stone-100 mb-2">Dynamo no encontrado</h2>
          <p className="text-xs text-stone-400 max-w-md mx-auto mb-6">
            El enlace que abriste no existe o el Dynamo fue eliminado permanentemente por su autor.
          </p>
          <button
            onClick={onBack}
            className="px-5 py-2 rounded-xl bg-amber-500 text-black text-xs font-bold hover:bg-amber-400 transition cursor-pointer"
          >
            Explorar Dynamos activos
          </button>
        </div>
      )}

      {/* Expired state (does not leak private/ephemeral content) */}
      {!isLoading && isExpired && (
        <div className="rounded-2xl border border-stone-800/80 bg-[#12161A] p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-stone-800/80 border border-stone-700 flex items-center justify-center mx-auto mb-4 text-stone-400">
            <Clock className="w-6 h-6 text-stone-400" />
          </div>
          <h2 className="text-lg font-bold text-stone-100 mb-2">Este Dynamo ha expirado</h2>
          <p className="text-xs text-stone-400 max-w-md mx-auto mb-6 leading-relaxed">
            En Dynamo el contenido tiene fecha de caducidad. Este mensaje concluyó su ciclo de vida y sus señales energéticas han sido selladas.
          </p>
          <button
            onClick={onBack}
            className="px-5 py-2 rounded-xl bg-amber-500 text-black text-xs font-bold hover:bg-amber-400 transition cursor-pointer"
          >
            Ver Dynamos vigentes
          </button>
        </div>
      )}

      {/* Moderated state */}
      {!isLoading && isModerated && (
        <div className="rounded-2xl border border-red-950/40 bg-[#161214] p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-red-950/40 border border-red-800/50 flex items-center justify-center mx-auto mb-4 text-red-400">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-red-200 mb-2">Contenido no disponible</h2>
          <p className="text-xs text-stone-400 max-w-md mx-auto mb-6">
            Esta publicación ha sido retirada u ocultada por moderación comunitaria.
          </p>
          <button
            onClick={onBack}
            className="px-5 py-2 rounded-xl border border-stone-800 text-stone-300 hover:text-white text-xs font-semibold transition cursor-pointer"
          >
            Volver al feed
          </button>
        </div>
      )}

      {/* Active Public Dynamo */}
      {!isLoading && dynamo && !isExpired && !isModerated && !notFound && (
        <div className="space-y-4">
          <DynamoCard
            dynamo={dynamo}
            onGiftEnergy={async (id) => {
              if (!user) {
                onOpenAuth();
                return;
              }
              return onGiftEnergy(id);
            }}
            onOpenReply={(d) => {
              if (!user) {
                onOpenAuth();
                return;
              }
              onOpenReply(d);
            }}
            onReport={onReport}
            onDelete={onDelete}
            onSelectHashtag={onSelectHashtag}
            onAuthorClick={onAuthorClick}
            onExpired={() => setIsExpired(true)}
          />

          {!user && (
            <div className="rounded-2xl border border-stone-800 bg-[#0E1216] p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-stone-200">¿Quieres participar en la conversación?</p>
                <p className="text-[11px] text-stone-400">Inicia sesión o regístrate en Dynamo para inyectar energía y responder.</p>
              </div>
              <button
                onClick={onOpenAuth}
                className="px-4 py-1.5 rounded-xl bg-amber-500 text-black text-xs font-bold hover:bg-amber-400 transition shrink-0 cursor-pointer"
              >
                Ingresar a Dynamo
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
