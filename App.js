import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  AppState,
} from 'react-native';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@drake_player:faixas';

const FAIXAS = [
  { id: '1', title: 'Bass Walker', artist: 'Kevin MacLeod', file: { uri: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Bass%20Walker.mp3' } },
  { id: '2', title: 'Funk Game Loop', artist: 'Kevin MacLeod', file: { uri: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Funk%20Game%20Loop.mp3' } },
  { id: '3', title: 'Sneaky Snitch', artist: 'Kevin MacLeod', file: { uri: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Sneaky%20Snitch.mp3' } },
  { id: '4', title: 'Monkeys Spinning Monkeys', artist: 'Kevin MacLeod', file: { uri: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Monkeys%20Spinning%20Monkeys.mp3' } },
  { id: '5', title: 'Hot Swing', artist: 'Kevin MacLeod', file: { uri: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Hot%20Swing.mp3' } },
];

const FAIXAS_BY_ID = FAIXAS.reduce((acc, faixa) => ({ ...acc, [faixa.id]: faixa }), {});

const ATRIBUICAO = 'Músicas: Kevin MacLeod (incompetech.com) — Licença CC BY 3.0';

function formatarTempo(ms) {
  const total = Math.floor(ms / 1000);
  const min = Math.floor(total / 60);
  const seg = total % 60;
  return `${min}:${seg.toString().padStart(2, '0')}`;
}

export default function AudioPlayerScreen() {
  const [faixas, setFaixas] = useState([]);
  const [sound, setSound] = useState(null);
  const [faixaAtual, setFaixaAtual] = useState(null);
  const [estaTocando, setEstaTocando] = useState(false);
  const [posicao, setPosicao] = useState(0);
  const [duracao, setDuracao] = useState(1);

  useEffect(() => {
    const carregar = async () => {
      try {
        const salvo = await AsyncStorage.getItem(STORAGE_KEY);
        if (salvo) {
          setFaixas(JSON.parse(salvo));
        } else {
          const padrao = FAIXAS.map(({ file, ...resto }) => resto);
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(padrao));
          setFaixas(padrao);
        }
      } catch (erro) {
        console.error('Erro ao carregar faixas:', erro);
      }
    };
    carregar();
  }, []);

  const aoAtualizarStatus = (status) => {
    if (status.isLoaded) {
      setPosicao(status.positionMillis);
      if (status.durationMillis) setDuracao(status.durationMillis);
      setEstaTocando(status.isPlaying);
    }
  };

  const tocar = async (faixa) => {
    try {
      if (sound && faixaAtual?.id === faixa.id) {
        if (estaTocando) {
          await sound.pauseAsync();
        } else {
          await sound.playAsync();
        }
        return;
      }

      if (sound) {
        await sound.unloadAsync();
        setSound(null);
      }

      console.log('Carregando áudio...');
      const { sound: novo } = await Audio.Sound.createAsync(
        FAIXAS_BY_ID[faixa.id].file,
        { shouldPlay: true, progressUpdateIntervalMillis: 500 },
        aoAtualizarStatus
      );
      setFaixaAtual(faixa);
      setPosicao(0);
      setSound(novo);
    } catch (erro) {
      console.error('Erro ao carregar o áudio:', erro);
    }
  };

  const remover = (id) => {
    Alert.alert('Remover faixa', 'Remover essa faixa da lista?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          const restantes = faixas.filter((f) => f.id !== id);
          setFaixas(restantes);
          try {
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(restantes));
          } catch (erro) {
            console.error('Erro ao remover faixa:', erro);
          }
          if (faixaAtual?.id === id) {
            if (sound) await sound.unloadAsync();
            setSound(null);
            setFaixaAtual(null);
            setEstaTocando(false);
          }
        },
      },
    ]);
  };

  useEffect(() => {
    const listener = AppState.addEventListener('change', (estado) => {
      if (estado !== 'active' && sound) {
        sound.pauseAsync();
        setEstaTocando(false);
      }
    });
    return () => listener.remove();
  }, [sound]);

  useEffect(() => {
    return sound
      ? () => {
          console.log('Descarregando áudio da memória...');
          sound.unloadAsync();
        }
      : undefined;
  }, [sound]);

  const progresso = duracao > 0 ? posicao / duracao : 0;

  const renderItem = ({ item }) => {
    const tocando = faixaAtual?.id === item.id;
    return (
      <View style={styles.item}>
        <TouchableOpacity style={styles.itemInfo} onPress={() => tocar(item)}>
          <Text style={styles.itemTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.itemArtist}>{item.artist}</Text>
          {tocando && (
            <Text style={styles.itemStatus}>{estaTocando ? '▶️ tocando' : '⏸️ pausada'}</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.botaoRemover} onPress={() => remover(item.id)}>
          <Text style={styles.textoRemover}>🗑️</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>DRAKE</Text>
      <Text style={styles.subtitle}>Player de músicas</Text>

      <FlatList
        data={faixas}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={styles.vazio}>Nenhuma faixa salva.</Text>}
        ListFooterComponent={<Text style={styles.creditos}>{ATRIBUICAO}</Text>}
      />

      {faixaAtual && (
        <View style={styles.player}>
          <Text style={styles.playerTitle} numberOfLines={1}>
            {faixaAtual.title}
          </Text>
          <View style={styles.linhaProgresso}>
            <View style={styles.barra}>
              <View style={[styles.barraPreenchida, { width: `${progresso * 100}%` }]} />
            </View>
            <Text style={styles.timer}>
              {formatarTempo(posicao)} / {formatarTempo(duracao)}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.botaoPlay, estaTocando && styles.botaoPausa]}
            onPress={() => tocar(faixaAtual)}
          >
            <Text style={styles.textoBotao}>{estaTocando ? 'Pausar ⏸️' : 'Tocar ▶️'}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a2037',
    paddingHorizontal: 16,
    paddingTop: 60,
  },
  title: {
    color: '#bff3ff',
    fontSize: 32,
    fontWeight: 'bold',
    letterSpacing: 8,
    textAlign: 'center',
  },
  subtitle: {
    color: '#9fc4d9',
    textAlign: 'center',
    marginBottom: 16,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0e3a63',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  itemInfo: {
    flex: 1,
  },
  itemTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  itemArtist: {
    color: '#9fc4d9',
    fontSize: 13,
  },
  itemStatus: {
    color: '#7fe7ff',
    fontSize: 12,
    marginTop: 4,
  },
  botaoRemover: {
    padding: 8,
  },
  textoRemover: {
    fontSize: 18,
  },
  vazio: {
    color: '#9fc4d9',
    textAlign: 'center',
    marginTop: 24,
  },
  creditos: {
    color: '#5b86a8',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  player: {
    backgroundColor: '#0e3a63',
    borderRadius: 12,
    padding: 16,
    marginVertical: 16,
  },
  playerTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 10,
  },
  linhaProgresso: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  barra: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#1e5a8c',
    overflow: 'hidden',
  },
  barraPreenchida: {
    height: '100%',
    backgroundColor: '#7fe7ff',
  },
  timer: {
    color: '#9fc4d9',
    fontSize: 12,
    marginLeft: 10,
  },
  botaoPlay: {
    backgroundColor: '#7fe7ff',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  botaoPausa: {
    backgroundColor: '#e14848',
  },
  textoBotao: {
    color: '#0a2037',
    fontWeight: 'bold',
    fontSize: 15,
  },
});