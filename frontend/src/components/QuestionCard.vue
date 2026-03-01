<template>
  <article class="qa-card-uiverse" :class="cardSizeClass" @click="$emit('click')">
    <div class="card-details">
      <div class="card-head">
        <slot name="head">
          <h3 class="text-title">{{ title }}</h3>
        </slot>
      </div>

      <slot name="meta" />

      <div class="answer-block">
        <slot name="body">
          <p class="text-body">{{ body }}</p>
        </slot>
      </div>

      <slot />
    </div>

    <button class="card-button" type="button" @click.stop="$emit('action')">{{ actionText }}</button>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  title?: string;
  body?: string;
  actionText?: string;
  compact?: boolean;
  size?: 'default' | 'md' | 'sm';
}>(), {
  compact: false,
  size: 'default',
  actionText: '操作',
});

const cardSizeClass = computed(() => {
  if (props.size === 'sm') return 'size-sm';
  if (props.size === 'md') return 'size-md';
  if (props.compact) return 'size-md';
  return 'size-default';
});

defineEmits<{
  (e: 'click'): void;
  (e: 'action'): void;
}>();
</script>

<style scoped>
.qa-card-uiverse {
  width: 100%;
  border-radius: 20px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.07), rgba(255, 255, 255, 0.03));
  position: relative;
  border: 1px solid var(--border-subtle);
  transition: 0.45s ease-out;
  overflow: hidden;
  cursor: pointer;
}

.qa-card-uiverse.size-default {
  min-height: 220px;
  padding: 0.95rem 1rem 3.15rem;
}

.qa-card-uiverse.size-md {
  min-height: 186px;
  padding: 0.85rem 0.9rem 2.95rem;
}

.qa-card-uiverse.size-sm {
  min-height: 164px;
  padding: 0.78rem 0.82rem 2.75rem;
}


.qa-card-uiverse:hover {
  border-color: var(--border-accent);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.22), 0 0 0 1px rgba(79, 159, 255, 0.25);
  transform: translateY(-3px);
}

.card-details {
  color: var(--text-primary);
  height: 100%;
  display: grid;
  align-content: start;
  gap: 0.55rem;
}

.card-head {
  display: grid;
  gap: 0.4rem;
}

.text-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.45;
}

.text-body {
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.58;
  font-size: 0.85rem;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.answer-block {
  display: grid;
  gap: 0.5rem;
}

.card-button {
  transform: translate(-50%, 125%);
  width: min(170px, calc(100% - 2rem));
  border-radius: 999px;
  border: none;
  background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple));
  color: #fff;
  font-size: 0.8rem;
  font-weight: 600;
  padding: 0.42rem 0.86rem;
  position: absolute;
  left: 50%;
  bottom: 0.8rem;
  opacity: 0;
  transition: 0.3s ease-out;
}

.qa-card-uiverse:hover .card-button {
  transform: translate(-50%, 0);
  opacity: 1;
}
</style>
